import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DISK_R, R_SUN, makeGalaxyCanvas, makeGalaxyParticles, constellationAtLon } from '../../lib/galaxy.js';
import { GLSL_PANO, loadPanorama, makeTexture } from '../../lib/skyTexture.js';

// 은하 모형 둘레에 '천구의 띠(은하수가 지나는 부분)'를 원통으로 세우고, 실제 은하수 사진을 붙인 그림.
// 원통의 중심은 지구(태양계)다. 원통 위 어느 점이든 지구에서 그 방향을 바라본 실제 하늘이 보인다.
const D2R = Math.PI / 180;
const R = 79; // 원통 반지름(kly): 은하 원반 전체(태양계에서 가장 먼 가장자리까지 약 7만 6천 광년)를 둘러쌀 만큼
const B_DIORAMA = 12; // 원통 높이: 은위 ±12°
const B_EARTH = 26;
const SUN = new THREE.Vector3(0, -R_SUN, 0);
const dirOf = (l) => new THREE.Vector3(-Math.sin(l * D2R), Math.cos(l * D2R), 0);

const WALL_VERT = `
uniform vec3 uSun;
varying vec3 vRel;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vRel = w.xyz - uSun;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WALL_FRAG = `
${GLSL_PANO}
uniform float uBmax;
uniform float uGain;
uniform float uAlpha;
varying vec3 vRel;
void main() {
  vec3 d = normalize(vRel);
  float b = degrees(asin(clamp(d.z, -1.0, 1.0)));
  if (abs(b) > uBmax) discard;
  // 모형 좌표 → 은하 좌표: x(은하 중심 쪽) = 모형 y, y(은경 90° 쪽) = -모형 x
  vec3 g = vec3(d.y, -d.x, d.z);
  vec3 c = panoColor(g) * uGain;
  float edge = smoothstep(uBmax, uBmax - 1.5, abs(b));
  vec3 base = vec3(0.02, 0.05, 0.12);
  gl_FragColor = vec4(mix(base, c + base * 0.6, edge), uAlpha * (0.35 + 0.65 * edge));
}`;

function alphaGalaxyTexture(size) {
  const src = makeGalaxyCanvas({ size, extent: 56 });
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    d[i + 3] = Math.min(255, m * 2.6);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function spriteTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** 바닥에 놓인 넓적한 화살표(태양계 → 원통 벽) */
function flatArrow(len, width, color, opacity) {
  const head = width * 2.2;
  const s = new THREE.Shape();
  s.moveTo(0, -width / 2);
  s.lineTo(len - head, -width / 2);
  s.lineTo(len - head, -width * 1.15);
  s.lineTo(len, 0);
  s.lineTo(len - head, width * 1.15);
  s.lineTo(len - head, width / 2);
  s.lineTo(0, width / 2);
  s.closePath();
  return new THREE.Mesh(
    new THREE.ShapeGeometry(s),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  );
}

const RIM_NAMES = [
  [0, '궁수자리'], [28, '독수리자리'], [80, '백조자리'], [118, '카시오페이아자리'], [165, '마차부자리'],
  [200, '외뿔소자리'], [235, '큰개·고물자리'], [287, '용골자리'], [302, '남십자자리'], [345, '전갈자리'],
];

export default function CelestialCylinder({ lon, setLon, mode = 'diorama', onDrag }) {
  const wrap = useRef(null);
  const cvs = useRef(null);
  const lbl = useRef(null);
  const st = useRef({});
  const [failed, setFailed] = useState(false);
  const live = useRef({ lon, mode });
  live.current = { lon, mode, setLon, onDrag };

  useEffect(() => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cvs.current, antialias: true });
    } catch {
      setFailed(true);
      return undefined;
    }
    const s = st.current;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x030a1e, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, cvs.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 30;
    controls.maxDistance = 600;
    controls.rotateSpeed = 0.55;
    controls.target.copy(SUN).add(new THREE.Vector3(0, 12, -4));

    // 은하 원반(위에서 본 그림) + 팽대부·막대 별
    const gtex = alphaGalaxyTexture(small ? 1024 : 2048);
    const disk = new THREE.Mesh(
      new THREE.PlaneGeometry(112, 112),
      new THREE.MeshBasicMaterial({ map: gtex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    disk.renderOrder = 1;
    scene.add(disk);
    const P = makeGalaxyParticles({ disk: 0, arm: 0, bulge: small ? 4000 : 7000, bar: small ? 1500 : 2500, halo: 0, globular: 0 });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P.position, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(P.color, 3));
    const pts = new THREE.Points(
      pg,
      new THREE.PointsMaterial({ size: 0.9, map: spriteTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }),
    );
    pts.renderOrder = 2;
    scene.add(pts);

    // 천구의 띠(원통): 안쪽 면은 진하게, 바깥쪽(앞쪽) 면은 반투명하게
    const H = 2 * R * Math.tan(B_EARTH * D2R) + 2;
    const cylGeo = new THREE.CylinderGeometry(R, R, H, 256, 1, true);
    cylGeo.rotateX(Math.PI / 2);
    const mkWall = (side, alpha, order) => {
      const m = new THREE.Mesh(
        cylGeo,
        new THREE.ShaderMaterial({
          vertexShader: WALL_VERT,
          fragmentShader: WALL_FRAG,
          uniforms: { uPano: { value: null }, uSun: { value: SUN.clone() }, uBmax: { value: B_DIORAMA }, uGain: { value: 1.5 }, uAlpha: { value: alpha } },
          side,
          transparent: true,
          depthWrite: false,
        }),
      );
      m.position.copy(SUN);
      m.renderOrder = order;
      scene.add(m);
      return m;
    };
    const inner = mkWall(THREE.BackSide, 1, 0);
    const outer = mkWall(THREE.FrontSide, 0.5, 5);
    let alive = true;
    loadPanorama().then(({ image }) => {
      if (!alive) return;
      const t = makeTexture(image);
      inner.material.uniforms.uPano.value = t;
      outer.material.uniforms.uPano.value = t;
    });
    // 원통 위·아래 테두리
    const rimMat = new THREE.LineBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.85 });
    const rims = [1, -1].map((sgn) => {
      const ptsR = [];
      for (let a = 0; a <= 360; a += 2) ptsR.push(new THREE.Vector3(R * Math.cos(a * D2R), R * Math.sin(a * D2R), 0));
      const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ptsR), rimMat);
      l.position.copy(SUN);
      l.userData.sgn = sgn;
      scene.add(l);
      return l;
    });

    // 화살표: 은하 중심 쪽(분홍) · 반대쪽(파랑)
    const toGC = flatArrow(R - 1, 3.2, 0xff8fb8, 0.72);
    toGC.position.set(SUN.x, SUN.y, 0.6);
    toGC.rotation.z = Math.PI / 2; // +x → +y(은하 중심 쪽)
    toGC.renderOrder = 4;
    const toAC = flatArrow(R - 1, 3.2, 0x7fd0ff, 0.6);
    toAC.position.set(SUN.x, SUN.y, 0.6);
    toAC.rotation.z = -Math.PI / 2;
    toAC.renderOrder = 4;
    scene.add(toGC, toAC);
    // 고른 시선
    const sightMat = new THREE.LineBasicMaterial({ color: 0xd9b8ff });
    const sight = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(R, 0, 0)]), sightMat);
    sight.position.copy(SUN).add(new THREE.Vector3(0, 0, 1.2));
    scene.add(sight);
    const sightTip = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd9b8ff }));
    scene.add(sightTip);
    // 은하 반지름 막대
    const radiusLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.8), new THREE.Vector3(DISK_R, 0, 0.8)]),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    radiusLine.rotation.z = -0.55;
    radiusLine.renderOrder = 6;
    scene.add(radiusLine);
    // 태양계
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sun.position.copy(SUN).add(new THREE.Vector3(0, 0, 0.8));
    scene.add(sun);

    // 글씨표
    const mk = (cls, html, color) => {
      const el = document.createElement('div');
      el.className = `lbl ${cls}`;
      el.style.setProperty('--c', color);
      el.innerHTML = html;
      lbl.current.appendChild(el);
      return el;
    };
    const narrow0 = wrap.current.getBoundingClientRect().width < 640;
    const L = {
      sun: mk('dot', '<span>태양계(지구)</span>', 'var(--c-sun)'),
      gc: mk('', '팽대부(은하 중심)', 'var(--c-bulge)'),
      bright: mk('big', narrow0 ? '넓고 밝은 은하수<br><small>팽대부 쪽 · 여름</small>' : '넓고 밝은 은하수<br><small>은하 중심(팽대부) 쪽을 바라본 모습 · 여름철 밤</small>', '#ffb3cf'),
      dim: mk('big', narrow0 ? '어둡고 가는 은하수<br><small>바깥쪽 · 겨울</small>' : '어둡고 가는 은하수<br><small>별이 적은 은하 바깥쪽을 바라본 모습 · 겨울철 밤</small>', 'var(--c-winter)'),
      sphere: mk('small', '천구의 일부: 지구에서 보이는 별들이 붙어 있다고 생각한 면', '#a9e6ff'),
      radius: mk('small', '은하의 반지름: 약 5만 광년', '#ffffff'),
      dist: mk('small', '약 8500 pc (약 2만 8천 광년)', '#ffd0e0'),
      sight: mk('', '', '#e6d6ff'),
    };
    const rimLbl = RIM_NAMES.map(([l, n]) => ({ l, el: mk('small', n, 'rgba(200,225,255,.95)') }));
    Object.assign(s, { renderer, scene, camera, controls, disk, pts, inner, outer, rims, toGC, toAC, sight, sightTip, radiusLine, L, rimLbl });

    const resize = () => {
      const r = wrap.current.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
      s.w = r.width;
      s.h = r.height;
      if (!s.started) {
        s.started = true;
        const p = dioramaPose(camera.aspect);
        camera.position.copy(p.pos);
        controls.target.copy(p.target);
        controls.update();
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);
    resize();

    // 지구에서 둘러보기: 좌우로 끌면 시선(은경)이 돈다
    let drag = null;
    const down = (e) => {
      drag = { x: e.clientX, y: e.clientY, lon: live.current.lon };
      if (s.anim) {
        camera.position.copy(s.anim.to);
        controls.target.copy(s.anim.tTo);
        s.anim = null;
      }
    };
    const move = (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) live.current.onDrag?.();
      if (live.current.mode === 'earth') {
        const r = cvs.current.getBoundingClientRect();
        const fovH = 2 * Math.atan(Math.tan((camera.fov * D2R) / 2) * camera.aspect) / D2R;
        const nl = (((drag.lon + ((e.clientX - drag.x) / r.width) * fovH) % 360) + 360) % 360;
        live.current.setLon?.(Math.round(nl));
      }
    };
    const up = () => (drag = null);
    cvs.current.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    const v = new THREE.Vector3();
    const place = (el, pos, show = true) => {
      if (!show) {
        el.style.opacity = 0;
        return;
      }
      v.copy(pos).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.05;
      el.style.opacity = vis ? 1 : 0;
      const x = Math.min(s.w - el.offsetWidth / 2 - 6, Math.max(el.offsetWidth / 2 + 6, ((v.x + 1) / 2) * s.w));
      el.style.transform = `translate(${x}px, ${((1 - v.y) / 2) * s.h}px) translate(-50%, -50%)`;
    };
    let raf = 0;
    let lastMode = live.current.mode;
    let blend = live.current.mode === 'earth' ? 1 : 0; // 0 = 원통 모형, 1 = 지구에서 보기
    let lookLon = live.current.lon;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { lon: L0, mode } = live.current;
      if (mode !== lastMode) {
        lastMode = mode;
        if (mode === 'diorama') {
          const p = dioramaPose(camera.aspect);
          s.anim = { from: camera.position.clone(), to: p.pos, tFrom: controls.target.clone(), tTo: p.target, t0: now };
          controls.enabled = true;
        } else {
          lookLon = L0;
          const to = SUN.clone().add(new THREE.Vector3(0, 0, 0.9));
          s.anim = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo: to.clone().add(dirOf(L0).multiplyScalar(40)), t0: now, earth: true };
          controls.enabled = false;
        }
      }
      blend += ((mode === 'earth' ? 1 : 0) - blend) * Math.min(1, dt * 3);
      // 시선 방향(은경)을 부드럽게
      let dl = ((L0 - lookLon + 540) % 360) - 180;
      lookLon = (lookLon + dl * Math.min(1, dt * 6) + 360) % 360;
      if (s.anim) {
        const t = Math.min(1, (now - s.anim.t0) / 1500);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(s.anim.from, s.anim.to, k);
        controls.target.lerpVectors(s.anim.tFrom, s.anim.tTo, k);
        camera.lookAt(controls.target);
        if (t >= 1) s.anim = null;
      } else if (mode === 'earth') {
        camera.position.copy(SUN).add(new THREE.Vector3(0, 0, 0.9));
        controls.target.copy(camera.position).add(dirOf(lookLon).multiplyScalar(40));
        camera.lookAt(controls.target);
      } else controls.update();
      const fovTarget = mode === 'earth' ? 62 : 42;
      if (Math.abs(camera.fov - fovTarget) > 0.05) {
        camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }
      // 모형은 지구에서 볼 때 흐리게(사진만 보이도록)
      const mOp = 1 - blend;
      disk.material.opacity = mOp;
      pts.material.opacity = 0.8 * mOp;
      disk.visible = pts.visible = mOp > 0.02;
      toGC.material.opacity = 0.72 * mOp;
      toAC.material.opacity = 0.6 * mOp;
      toGC.visible = toAC.visible = radiusLine.visible = mOp > 0.02;
      const bmax = B_DIORAMA + (B_EARTH - B_DIORAMA) * blend;
      inner.material.uniforms.uBmax.value = bmax;
      outer.material.uniforms.uBmax.value = bmax;
      outer.visible = blend < 0.5;
      rims.forEach((r) => (r.position.z = r.userData.sgn * R * Math.tan(bmax * D2R)));
      // 고른 시선
      const dir = dirOf(L0);
      sight.rotation.z = Math.atan2(dir.y, dir.x);
      sight.visible = mOp > 0.02;
      sightTip.position.copy(SUN).addScaledVector(dir, R - 1.5).add(new THREE.Vector3(0, 0, 1.2));
      sightTip.visible = mOp > 0.02;
      renderer.render(scene, camera);

      // 글씨
      const zTop = R * Math.tan(bmax * D2R);
      const show = mOp > 0.5;
      const narrow = s.w < 640;
      place(L.sun, sun.position, show);
      place(L.gc, new THREE.Vector3(9, 4, 9), show);
      place(L.bright, SUN.clone().addScaledVector(dirOf(0), R).add(new THREE.Vector3(0, 0, zTop + 10)), show);
      place(L.dim, SUN.clone().addScaledVector(dirOf(180), R).add(new THREE.Vector3(0, 0, -zTop - 7)), show);
      place(L.sphere, SUN.clone().addScaledVector(dirOf(250), R).add(new THREE.Vector3(0, 0, -zTop - 6)), show && !narrow);
      const rp = new THREE.Vector3(DISK_R * 0.82, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.55);
      place(L.radius, rp.add(new THREE.Vector3(0, 0, 4)), show && !narrow);
      place(L.dist, new THREE.Vector3(0, 0, 0), false);
      const lab = `시선: ${constellationAtLon(L0)}`;
      if (L.sight.textContent !== lab) L.sight.textContent = lab;
      place(L.sight, SUN.clone().addScaledVector(dir, R).add(new THREE.Vector3(0, 0, show ? 5 : 0)), show && !(narrow && (L0 < 30 || L0 > 330 || Math.abs(L0 - 180) < 30)));
      rimLbl.forEach(({ l, el }) => {
        const p = SUN.clone().addScaledVector(dirOf(l), R * 0.995).add(new THREE.Vector3(0, 0, show ? zTop + 3.5 : 0));
        if (!show) {
          // 지구에서 볼 때: 은하 적도 높이에 별자리 이름
          p.copy(SUN).addScaledVector(dirOf(l), R * 0.98).add(new THREE.Vector3(0, 0, -R * Math.tan(9 * D2R)));
        }
        // 모형에서는 큰 설명이 있는 은하 중심·반대 방향 근처 이름을 숨김
        const nearBig = show && (Math.abs(((l + 540) % 360) - 180) < 40 || Math.abs(l - 180) < 25);
        place(el, p, !nearBig && !(narrow && show));
      });
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      cvs.current?.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      controls.dispose();
      gtex.dispose();
      renderer.dispose();
      if (lbl.current) lbl.current.innerHTML = '';
      Object.keys(s).forEach((k) => delete s[k]);
    };
  }, []);

  if (failed) return <div className="fill" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>이 기기에서는 3D 그래픽(WebGL)을 쓸 수 없어요.</div>;
  return (
    <div ref={wrap} className="fill">
      <canvas ref={cvs} className="fill grab" aria-label="우리은하를 둘러싼 천구의 띠(원통)에 실제 은하수 사진을 붙인 모형. 끌어서 돌리기" />
      <div ref={lbl} className="labels" />
    </div>
  );
}

/** 교과서 그림처럼: 은하 중심 반대쪽 위에서 비스듬히 내려다봄 */
function dioramaPose(aspect) {
  const dist = Math.max(255, 330 / Math.max(0.55, aspect));
  const el = 34 * D2R;
  const target = SUN.clone().add(new THREE.Vector3(0, 4, -14));
  const pos = target.clone().add(new THREE.Vector3(0, -dist * Math.cos(el), dist * Math.sin(el)));
  return { pos, target };
}
