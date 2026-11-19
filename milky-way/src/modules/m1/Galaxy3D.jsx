import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ARMS, BAR, BULGE, DISK_R, HALO_R, KNOWN_GLOBULARS, R_SUN, armRadius, barFrame, makeGalaxyCanvas, makeGalaxyParticles, nearestArm, polarToXY,
} from '../../lib/galaxy.js';
import { STRUCTURES } from '../../data/structures.js';

const D2R = Math.PI / 180;
export const VIEWS = {
  start: { r: 130, p: 58, a: -90, fit: [120, 78] },
  top: { r: 135, p: 0.05, a: -90, fit: [114, 114] },
  side: { r: 120, p: 90, a: 0, fit: [124, 44] },
};
/** 화면 비율에 맞춰 가로·세로(kly)가 다 들어오는 카메라 거리 */
function fitDistance(camera, [w, h]) {
  const t = Math.tan((camera.fov * D2R) / 2);
  return Math.min(MAX_R, Math.max(w / (2 * t * camera.aspect), h / (2 * t)));
}
const MIN_R = 10;
const MAX_R = 460;

const VERT = `
attribute vec3 color;
attribute float size;
attribute float group;
uniform float uScale;
uniform float uSel[6];
uniform float uAny;
uniform float uHalo;
uniform float uMaxSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  int g = int(group + 0.5);
  float sel = 0.0;
  for (int i = 0; i < 6; i++) { if (i == g) sel = uSel[i]; }
  float hi = uAny > 0.5 ? (sel > 0.5 ? 1.8 : 0.22) : 1.0;
  float vis = (g >= 4) ? uHalo : 1.0;
  float s = size * uScale / max(1.0, -mv.z);
  gl_PointSize = clamp(s, 1.2, uMaxSize);
  float fade = clamp(s / 1.2, 0.25, 1.0);
  vColor = color * hi;
  vAlpha = vis * fade * (g == 4 ? 0.7 : 1.0);
}`;
const FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = 1.0 - smoothstep(0.0, 0.5, r);
  a = a * a * (0.6 + 0.4 * a);
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;

const HALO_VERT = `
varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const HALO_FRAG = `
uniform float uStrength; uniform vec3 uColor;
varying vec3 vN; varying vec3 vV;
void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 3.0) * uStrength; gl_FragColor = vec4(uColor * a, 1.0); }`;

function sph(v) {
  const p = Math.max(0.03, Math.min(179.97, v.p)) * D2R;
  const a = v.a * D2R;
  return new THREE.Vector3(v.r * Math.sin(p) * Math.cos(a), v.r * Math.sin(p) * Math.sin(a), v.r * Math.cos(p));
}
function toSph(pos) {
  const r = pos.length();
  return { r, p: Math.acos(pos.z / r) / D2R, a: Math.atan2(pos.y, pos.x) / D2R };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 클릭한 곳의 구조를 찾는다: 시선을 따라가며 먼저 만나는 구조 */
function pickStructure(ray) {
  const o = ray.origin;
  const d = ray.direction;
  // 헤일로 구와 만나는 구간
  const b = o.dot(d);
  const c = o.lengthSq() - HALO_R * HALO_R;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t0 = Math.max(0, -b - Math.sqrt(disc));
  const t1 = -b + Math.sqrt(disc);
  const steps = 700;
  const p = new THREE.Vector3();
  let closestGC = null;
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    p.copy(o).addScaledVector(d, t);
    const R = Math.hypot(p.x, p.y);
    const { u, v } = barFrame(p.x, p.y);
    if ((u / BULGE.a) ** 2 + (v / BULGE.b) ** 2 + (p.z / BULGE.c) ** 2 < 1) return 'bulge';
    if (Math.abs(p.z) < 1.6 && (u / BAR.half) ** 2 + (v / (BAR.width * 0.9)) ** 2 < 1) return 'bar';
    if (Math.abs(p.z) < 1.4 && R < DISK_R + 1) {
      if (Math.hypot(p.x, p.y + R_SUN) < 1.6) return 'sun';
      const na = nearestArm(p.x, p.y);
      if (na.d < na.arm.w * 1.2) return { id: 'arm', arm: na.arm };
      return 'disk';
    }
    if (!closestGC) {
      for (const g of KNOWN_GLOBULARS) {
        if (Math.hypot(p.x - g.xyz[0], p.y - g.xyz[1], p.z - g.xyz[2]) < 2.2) closestGC = 'globular';
      }
    }
  }
  return closestGC || 'halo';
}

const Galaxy3D = forwardRef(function Galaxy3D({ halo = true, labels = true, selected = null, onPick, onAction, onZoom, measure = true }, ref) {
  const wrap = useRef(null);
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const svgRef = useRef(null);
  const st = useRef({});
  const [failed, setFailed] = useState(false);

  // 설정이 바뀌면 장면에 반영
  useEffect(() => {
    const s = st.current;
    if (!s.points) return;
    s.points.material.uniforms.uHalo.value = halo ? 1 : 0;
    s.haloMesh.visible = halo;
  }, [halo]);
  useEffect(() => {
    const s = st.current;
    if (!s.points) return;
    const groups = selected ? STRUCTURES[selected]?.groups || [] : [];
    const sel = [0, 0, 0, 0, 0, 0];
    groups.forEach((g) => (sel[g] = 1));
    s.points.material.uniforms.uSel.value = sel;
    s.points.material.uniforms.uAny.value = groups.length ? 1 : 0;
    s.plane.material.opacity = !groups.length ? 0.75 : groups.some((g) => g <= 1 || g === 3) ? 0.9 : 0.2;
    s.haloMesh.material.uniforms.uStrength.value = selected === 'halo' ? 1.1 : 0.16;
    s.selected = selected;
  }, [selected]);

  useImperativeHandle(ref, () => ({
    setView(name) {
      const s = st.current;
      if (!s.camera) return;
      const from = toSph(s.camera.position);
      const to = { ...(VIEWS[name] || VIEWS.start) };
      to.r = fitDistance(s.camera, to.fit);
      // 가장 가까운 방향으로 돌기
      let da = to.a - from.a;
      while (da > 180) da -= 360;
      while (da < -180) da += 360;
      s.anim = { from, to: { ...to, a: from.a + da }, t0: performance.now(), dur: 1300 };
    },
    setDistance(r) {
      const s = st.current;
      if (!s.camera) return;
      const v = toSph(s.camera.position);
      s.camera.position.copy(sph({ ...v, r }));
      s.controls.update();
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return undefined;
    }
    const s = st.current;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x03081a, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
    camera.up.set(0, 0, 1);
    camera.position.copy(sph(VIEWS.start));
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;
    controls.enablePan = false;
    controls.minDistance = MIN_R;
    controls.maxDistance = MAX_R;
    controls.target.set(0, 0, 0);
    controls.update();

    // 위에서 본 원반 그림(나선팔·먼지 띠)
    const tex = new THREE.CanvasTexture(makeGalaxyCanvas({ size: small ? 1024 : 2048, extent: 56 }));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(112, 112),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.75 }),
    );
    scene.add(plane);

    // 별 입자
    const P = makeGalaxyParticles(small ? { disk: 14000, arm: 12000, bulge: 6000, bar: 3000, halo: 2500 } : {});
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P.position, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(P.color, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(P.size, 1));
    geo.setAttribute('group', new THREE.BufferAttribute(P.group, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uScale: { value: 300 },
        uSel: { value: [0, 0, 0, 0, 0, 0] },
        uAny: { value: 0 },
        uHalo: { value: 1 },
        uMaxSize: { value: 14 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // 헤일로 경계(희미한 공)
    const haloMesh = new THREE.Mesh(
      new THREE.SphereGeometry(HALO_R, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
        uniforms: { uStrength: { value: 0.16 }, uColor: { value: new THREE.Color('#9a6cff') } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      }),
    );
    haloMesh.scale.set(1, 1, 0.85);
    scene.add(haloMesh);

    // 태양계 위치 표시
    const sunMark = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sunMark.position.set(0, -R_SUN, 0);
    scene.add(sunMark);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 48), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.set(0, -R_SUN, 0.05);
    scene.add(ring);

    Object.assign(s, { renderer, scene, camera, controls, points, plane, haloMesh, ring, sunMark, tex });

    // 이름표 위치
    const anchors = [
      { id: 'bulge', text: '팽대부', pos: [0, 0, BULGE.c + 1.2], color: 'var(--c-bulge)', cls: 'big pin' },
      { id: 'bar', text: '막대', pos: [...polarToXY(BAR.half + 1, BAR.beta), 0], color: 'var(--c-bar)', cls: 'pin' },
      { id: 'disk', text: '원반', pos: [...polarToXY(46, 125), 0], color: 'var(--c-disk)', cls: 'big pin' },
      { id: 'halo', text: '헤일로', pos: [-62, 30, 52], color: 'var(--c-halo)', cls: 'big pin', halo: true },
      { id: 'sun', text: '태양계', pos: [0, -R_SUN, 0], color: 'var(--c-sun)', cls: 'pin dot', dy: 0 },
      ...ARMS.flatMap((a) =>
        a.labels.map((l) => ({ id: 'arm', arm: a.id, text: l.text, pos: [...polarToXY(armRadius(a, l.beta), l.beta), 0], color: 'var(--c-arm)', cls: 'small pin' })),
      ),
      ...KNOWN_GLOBULARS.map((g) => ({ id: 'globular', text: g.id === 'm13' ? 'M13' : '오메가 센타우리', pos: g.xyz, color: 'var(--c-gc)', cls: 'small pin', halo: true })),
    ];
    const lblEls = anchors.map((a) => {
      const el = document.createElement('div');
      el.className = `lbl ${a.cls}`;
      el.style.setProperty('--c', a.color);
      el.innerHTML = a.cls.includes('dot') ? `<span>${a.text}</span>` : a.text;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const armObj = a.arm ? ARMS.find((x) => x.id === a.arm) : null;
        onPickRef.current?.(a.id, armObj);
      });
      labelRef.current.appendChild(el);
      return el;
    });
    s.anchors = anchors;
    s.lblEls = lblEls;

    // 크기·창 변화
    const resize = () => {
      const r = wrap.current.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
      s.w = r.width;
      s.h = r.height;
      mat.uniforms.uScale.value = (r.height / 900) * 340 * renderer.getPixelRatio();
      mat.uniforms.uMaxSize.value = 14 * renderer.getPixelRatio();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);
    resize();
    camera.position.copy(sph({ ...VIEWS.start, r: fitDistance(camera, VIEWS.start.fit) }));
    controls.update();

    // 조작 기록
    let downAt = null;
    const onDown = (e) => {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      s.anim = null;
    };
    const onUp = (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      if (moved > 8) onActionRef.current?.('drag');
      else if (performance.now() - downAt.t < 600) {
        const r = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(ndc, camera);
        const hit = pickStructure(rc.ray);
        if (hit) {
          if (typeof hit === 'object') onPickRef.current?.(hit.id, hit.arm);
          else if (hit !== 'halo' || s.haloOn !== false) onPickRef.current?.(hit);
        }
      }
      downAt = null;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    const onWheel = () => onActionRef.current?.('zoom');
    canvas.addEventListener('wheel', onWheel, { passive: true });

    // 그리기
    const v = new THREE.Vector3();
    let raf = 0;
    let lastR = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (s.anim) {
        const t = Math.min(1, (performance.now() - s.anim.t0) / s.anim.dur);
        const k = ease(t);
        const f = s.anim.from;
        const to = s.anim.to;
        camera.position.copy(sph({ r: f.r + (to.r - f.r) * k, p: f.p + (to.p - f.p) * k, a: f.a + (to.a - f.a) * k }));
        camera.lookAt(0, 0, 0);
        if (t >= 1) s.anim = null;
      } else controls.update();
      const camDist = camera.position.length();
      if (Math.abs(camDist - (s.lastDist || 0)) / camDist > 0.004) {
        s.lastDist = camDist;
        onZoomRef.current?.(camDist);
      }
      const now = performance.now();
      ring.lookAt(camera.position);
      ring.scale.setScalar(Math.max(0.6, camera.position.distanceTo(ring.position) / 120));
      sunMark.scale.setScalar(Math.max(0.6, camera.position.distanceTo(sunMark.position) / 120));
      renderer.render(scene, camera);

      // 이름표
      const showLabels = s.labels !== false;
      const camR = camera.position.length();
      anchors.forEach((a, i) => {
        const el = lblEls[i];
        if (!showLabels || (a.halo && s.haloOn === false)) {
          el.style.opacity = 0;
          el.style.pointerEvents = 'none';
          return;
        }
        v.set(a.pos[0], a.pos[1], a.pos[2]).project(camera);
        const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        const polarNow = Math.acos(camera.position.z / camR) / D2R;
        const armHidden = (a.id === 'arm' && polarNow > 48 && polarNow < 132 && s.selected !== 'arm')
          || ((a.id === 'bar' || a.id === 'disk') && Math.abs(polarNow - 90) < 14 && measureRef.current);
        const tooSmall = (a.cls.includes('small') && camR > 300) || armHidden;
        const op = vis && !tooSmall ? (s.selected && s.selected !== a.id ? 0.45 : 1) : 0;
        el.style.opacity = op;
        el.style.pointerEvents = op ? 'auto' : 'none';
        el.style.transform = `translate(${((v.x + 1) / 2) * s.w}px, ${((1 - v.y) / 2) * s.h}px) translate(-50%, -50%)`;
      });

      // 치수선(옆에서 볼 때 두께·지름 비교, 위에서 볼 때 지름·태양 거리)
      if (svgRef.current && now - lastR > 30) {
        lastR = now;
        drawMeasure(svgRef.current, camera, s, measureRef.current);
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      controls.dispose();
      lblEls.forEach((el) => el.remove());
      geo.dispose();
      mat.dispose();
      tex.dispose();
      renderer.dispose();
      Object.keys(s).forEach((k) => delete s[k]);
    };
  }, []);

  // 최신 콜백을 참조로 유지
  const onPickRef = useRef(onPick);
  const onActionRef = useRef(onAction);
  const onZoomRef = useRef(onZoom);
  const measureRef = useRef(measure);
  onPickRef.current = onPick;
  onActionRef.current = onAction;
  onZoomRef.current = onZoom;
  measureRef.current = measure;
  useEffect(() => {
    st.current.labels = labels;
  }, [labels]);
  useEffect(() => {
    st.current.haloOn = halo;
  }, [halo]);

  if (failed) {
    return (
      <div className="fill" style={{ display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center', color: 'var(--ink-2)' }}>
        이 기기에서는 3D 그래픽(WebGL)을 쓸 수 없어요. 다른 브라우저(크롬, 엣지, 사파리 최신판)로 열어 주세요.
      </div>
    );
  }
  return (
    <div ref={wrap} className="fill">
      <canvas ref={canvasRef} className="fill grab" aria-label="우리 은하 3D 모형. 끌어서 돌리고, 휠이나 두 손가락으로 확대·축소" />
      <svg ref={svgRef} className="fill" style={{ pointerEvents: 'none', zIndex: 2 }} aria-hidden="true" />
      <div ref={labelRef} className="labels" />
    </div>
  );
});

export default Galaxy3D;

// ───────── 치수선 ─────────
function proj(camera, s, x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: ((v.x + 1) / 2) * s.w, y: ((1 - v.y) / 2) * s.h, ok: v.z < 1 };
}
function drawMeasure(svg, camera, s, on) {
  const pos = camera.position;
  const r = pos.length();
  const polar = Math.acos(pos.z / r) / D2R;
  const side = Math.abs(polar - 90) < 14;
  const top = polar < 16 || polar > 164;
  if (!on || (!side && !top) || s.anim) {
    if (svg.childNodes.length) svg.innerHTML = '';
    return;
  }
  const parts = [];
  const line = (a, b, color, dash = '') =>
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const text = (p, t, color, anchor = 'middle', dy = 0) =>
    `<text x="${p.x}" y="${p.y + dy}" fill="${color}" font-size="15" font-weight="700" text-anchor="${anchor}" paint-order="stroke" stroke="#040a17" stroke-width="5" stroke-linejoin="round">${t}</text>`;
  const defs = '<defs><marker id="m1-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff5a5a"/></marker></defs>';
  const arrow = (a, b) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ff5a5a" stroke-width="4" stroke-linecap="round" marker-end="url(#m1-ah)"/>`;
  const Sn = proj(camera, s, 0, -R_SUN, 0);
  const C0 = proj(camera, s, 0, 0, 0);
  const toward = (f) => ({ x: Sn.x + (C0.x - Sn.x) * f, y: Sn.y + (C0.y - Sn.y) * f });
  parts.push(defs);
  if (side) {
    // 화면에서 가로 방향(은하 평면 위)
    const dir = new THREE.Vector3(-pos.y, pos.x, 0).normalize();
    // 은하의 적도: 은하 원반 한가운데를 지나는 평면(옆에서 보면 직선)
    const E1 = proj(camera, s, -dir.x * 66, -dir.y * 66, 0);
    const E2 = proj(camera, s, dir.x * 66, dir.y * 66, 0);
    parts.push(line(E1, E2, 'rgba(111,211,154,.85)'));
    const Et = E1.x > E2.x ? E1 : E2;
    parts.push(text({ x: Math.min(s.w - 12, Et.x), y: Et.y }, '은하의 적도', '#8fe6b4', 'end', -12));
    const dz = -12;
    const A = proj(camera, s, -dir.x * DISK_R, -dir.y * DISK_R, dz);
    const B = proj(camera, s, dir.x * DISK_R, dir.y * DISK_R, dz);
    const A0 = proj(camera, s, -dir.x * DISK_R, -dir.y * DISK_R, 0);
    const B0 = proj(camera, s, dir.x * DISK_R, dir.y * DISK_R, 0);
    parts.push(line(A, B, '#b3bfff'), line(A, A0, '#b3bfff', '4 4'), line(B, B0, '#b3bfff', '4 4'));
    parts.push(text({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, '지름 약 10만 광년', '#dfe5ff', 'middle', 22));
    // 태양 → 은하 중심
    const sunSide = Math.abs(Sn.x - C0.x) > 20;
    if (sunSide) {
      parts.push(arrow(toward(0.06), toward(0.62)));
      const y6 = proj(camera, s, 0, -R_SUN, -6.5);
      const c6 = proj(camera, s, 0, 0, -6.5);
      parts.push(line(y6, c6, '#ffe14d'), line(Sn, y6, '#ffe14d', '3 4'), line(C0, c6, '#ffe14d', '3 4'));
      parts.push(text({ x: (y6.x + c6.x) / 2, y: y6.y }, '약 2만 6천 광년', '#ffe14d', 'middle', 18));
    }
    // 팽대부 두께(태양 반대쪽에 표시)
    const sgn = sunSide && (Sn.x - C0.x) * (B0.x - A0.x) > 0 ? -1 : 1;
    const bx = sgn * dir.x * (BULGE.a + 3);
    const by = sgn * dir.y * (BULGE.a + 3);
    const T1 = proj(camera, s, bx, by, BULGE.c + 0.6);
    const T2 = proj(camera, s, bx, by, -BULGE.c - 0.6);
    const right = T1.x >= C0.x;
    parts.push(line(T1, T2, '#ffc46b'), line({ x: T1.x - 6, y: T1.y }, { x: T1.x + 6, y: T1.y }, '#ffc46b'), line({ x: T2.x - 6, y: T2.y }, { x: T2.x + 6, y: T2.y }, '#ffc46b'));
    parts.push(
      text({ x: T1.x + (right ? 10 : -10), y: (T1.y + T2.y) / 2 - 8 }, '팽대부 두께', '#ffc46b', right ? 'start' : 'end'),
      text({ x: T1.x + (right ? 10 : -10), y: (T1.y + T2.y) / 2 + 12 }, '약 1만 광년 이상', '#ffc46b', right ? 'start' : 'end'),
    );
    // 원반 두께(팽대부 쪽 바깥 원반)
    const D = proj(camera, s, sgn * dir.x * 34, sgn * dir.y * 34, 0);
    const Lp = { x: D.x, y: D.y - 74 };
    parts.push(line(D, Lp, '#7cc4ff', '3 3'));
    parts.push(text(Lp, '원반 두께 약 1천 광년', '#a9d6ff', 'middle', -8), text(Lp, '(지름의 약 1/100)', '#a9d6ff', 'middle', 12));
  } else {
    const A = proj(camera, s, -DISK_R, 0, 0);
    const B = proj(camera, s, DISK_R, 0, 0);
    parts.push(line(A, B, 'rgba(179,191,255,.55)', '6 6'));
    parts.push(text({ x: A.x + (B.x - A.x) * 0.82, y: A.y }, '지름 약 10만 광년', '#dfe5ff', 'middle', -10));
    parts.push(line(C0, Sn, 'rgba(255,225,77,.6)', '5 5'));
    parts.push(arrow(toward(0.08), toward(0.5)));
    parts.push(text({ x: Sn.x + 20, y: Sn.y }, '태양 → 은하 중심', '#ff8a8a', 'start', -2));
    parts.push(text({ x: Sn.x + 20, y: Sn.y }, '약 2만 6천 광년', '#ffe14d', 'start', 18));
  }
  svg.innerHTML = parts.join('');
}
