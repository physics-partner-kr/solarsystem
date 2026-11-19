import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { D2R, EQ2GAL, OBLIQUITY, OBSERVER, eclToEq, eqToEcl, galToEq, gmstDeg, sunEclipticLon, unit } from '../../lib/astro.js';
import { GLSL_PANO, loadPanorama, makeTexture } from '../../lib/skyTexture.js';
import { EARTH_MAP } from '../../data/photos.js';
import { CONST_NAMES } from '../../data/skyData.js';
import { NAME_FIX } from '../../lib/skyMath.js';

// 장면 좌표: x = 춘분점 방향, y = 황도 북극(위), z = -(황도 y)
const ORBIT_R = 10;
const EARTH_R = 1.0;
const SKY_R = 600;
const eclToScene = (lamDeg, betaDeg = 0, r = 1) => {
  const l = lamDeg * D2R;
  const b = betaDeg * D2R;
  return new THREE.Vector3(r * Math.cos(b) * Math.cos(l), r * Math.sin(b), -r * Math.cos(b) * Math.sin(l));
};
const eqToScene = (ra, dec, r = 1) => {
  const e = eqToEcl(ra, dec);
  return eclToScene(e.lam, e.beta, r);
};

// 황도를 따라 지나는 별자리(황경 경계, IAU 경계 기준 근삿값)
const ECL_CONST = [
  [0, '물고기자리'], [29, '양자리'], [53.5, '황소자리'], [90.2, '쌍둥이자리'], [118, '게자리'], [138, '사자자리'], [174, '처녀자리'],
  [218, '천칭자리'], [241, '전갈자리'], [248, '뱀주인자리'], [266, '궁수자리'], [300, '염소자리'], [328, '물병자리'], [351.6, '물고기자리'],
];
export function constellationOnEcliptic(lam) {
  let n = ECL_CONST[0][1];
  for (const [a, name] of ECL_CONST) if (lam >= a) n = name;
  return n;
}

const SKY_FRAG = `
${GLSL_PANO}
uniform mat3 uS2G;
uniform float uGain;
varying vec3 vDir;
void main() {
  vec3 g = uS2G * normalize(vDir);
  vec3 c = panoColor(g) * uGain;
  gl_FragColor = vec4(c, 1.0);
}`;
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function sceneToGalMatrix() {
  // 장면 → 황도 → 적도 → 은하
  const e = OBLIQUITY * D2R;
  const S2E = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ]; // 장면(x,y,z) → 황도(x, -z, y)
  const E2Q = [
    [1, 0, 0],
    [0, Math.cos(e), -Math.sin(e)],
    [0, Math.sin(e), Math.cos(e)],
  ];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(EQ2GAL, mul(E2Q, S2E));
}

function arrowMesh(color, len = 2, head = 0.45, rad = 0.06) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len - head, 12), m);
  shaft.position.y = (len - head) / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(rad * 3, head, 16), m);
  tip.position.y = len - head / 2;
  g.add(shaft, tip);
  return g;
}

function curvedArrow(radius, color, from = 20, to = 300, tube = 0.05) {
  const pts = [];
  for (let a = from; a <= to; a += 4) pts.push(new THREE.Vector3(radius * Math.cos(a * D2R), 0, -radius * Math.sin(a * D2R)));
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, tube, 8, false), m));
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const tip = new THREE.Mesh(new THREE.ConeGeometry(tube * 3.2, tube * 9, 16), m);
  tip.position.copy(end);
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(prev).normalize());
  g.add(tip);
  return g;
}

/**
 * 우주에서 본 지구의 공전·자전.
 * props: date(UTC), ghosts([{date,color,label}]), follow(지구 가까이 따라가기), showSky, nightCone
 */
const earthPos = (date) => eclToScene(sunEclipticLon(date) + 180, 0, ORBIT_R);
/** 지구의 밤하늘 방향이 화면 안쪽(먼 하늘)을 향하도록: 태양 너머 반대편 위에서 바라봄 */
function behindPos(date) {
  const lam = sunEclipticLon(date) + 180;
  return eclToScene(lam, 0, 1).multiplyScalar(-19).add(new THREE.Vector3(0, 17, 0));
}
/** 지구 낮 쪽 뒤에서 밤하늘 방향을 바라봄(지구 너머로 그 계절 밤하늘이 보임) */
function nightPose(date) {
  const E = earthPos(date);
  const d = E.clone().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  return E.clone().addScaledVector(d, -8.5).addScaledVector(side, 2.6).add(new THREE.Vector3(0, 1.5, 0));
}
const nightTarget = (date) => {
  const E = earthPos(date);
  return E.clone().addScaledVector(E.clone().normalize(), 3);
};
/** 자전 보기: 지구 북극 위쪽, 밤 쪽으로 조금 비켜서 */
function followPose(date) {
  const E = earthPos(date);
  const d = E.clone().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  return E.clone().addScaledVector(side, 5.4).addScaledVector(d, 1.4).add(new THREE.Vector3(0, 2.2, 0));
}

const OrbitView = forwardRef(function OrbitView({ date, ghosts = [], follow = false, showSky = true, nightCone = true, labels = true, seasonMarks = true }, ref) {
  const wrap = useRef(null);
  const cvs = useRef(null);
  const lbl = useRef(null);
  const st = useRef({});
  const [failed, setFailed] = useState(false);
  const props = useRef({});
  props.current = { date, ghosts, follow, showSky, nightCone, labels, seasonMarks };

  useImperativeHandle(ref, () => ({
    view(name, d) {
      const s = st.current;
      if (!s.camera) return;
      const date = d || props.current.date;
      const E = earthPos(date);
      if (name === 'night') {
        s.mode = 'night';
        s.anim = { from: s.camera.position.clone(), to: nightPose(date), tFrom: s.controls.target.clone(), tTo: nightTarget(date), t0: performance.now() };
        return;
      }
      s.mode = 'overview';
      const to = name === 'top' ? new THREE.Vector3(0.01, 34, 0.01) : behindPos(date);
      s.anim = { from: s.camera.position.clone(), to, tFrom: s.controls.target.clone(), tTo: new THREE.Vector3(), t0: performance.now() };
    },
  }));

  useEffect(() => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cvs.current, antialias: true });
    } catch {
      setFailed(true);
      return undefined;
    }
    const s = st.current;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x02060f, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 3000);
    camera.position.copy(behindPos(props.current.date));
    const controls = new OrbitControls(camera, cvs.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 80;
    controls.rotateSpeed = 0.6;

    // 하늘(실제 은하수 사진)
    const S2G = sceneToGalMatrix();
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uPano: { value: null }, uS2G: { value: new THREE.Matrix3().set(...S2G.flat()) }, uGain: { value: 0.9 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 64, 32), skyMat);
    scene.add(sky);
    let alive = true;
    loadPanorama().then(({ image }) => {
      if (!alive) return;
      skyMat.uniforms.uPano.value = makeTexture(image);
    });

    // 태양
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    scene.add(sun);
    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,220,140,1)');
      grd.addColorStop(0.3, 'rgba(255,190,90,.45)');
      grd.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false }));
    sunGlow.scale.set(9, 9, 1);
    scene.add(sunGlow);
    scene.add(new THREE.PointLight(0xffffff, 3.2, 0, 0));
    scene.add(new THREE.AmbientLight(0x6d82b0, 0.9));

    // 공전 궤도와 공전 방향
    const orbitLine = new THREE.Mesh(new THREE.TorusGeometry(ORBIT_R, 0.03, 8, 200), new THREE.MeshBasicMaterial({ color: 0x6cb8ff, transparent: true, opacity: 0.6 }));
    orbitLine.rotation.x = Math.PI / 2;
    scene.add(orbitLine);
    const revArrows = new THREE.Group();
    [30, 120, 210, 300].forEach((a) => {
      const ar = curvedArrow(ORBIT_R, 0x8cc8ff, a, a + 22, 0.07);
      revArrows.add(ar);
    });
    scene.add(revArrows);

    // 지구
    const earthTilt = new THREE.Group();
    earthTilt.rotation.x = -OBLIQUITY * D2R;
    const earthSpin = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const earthMat = new THREE.MeshLambertMaterial({ color: 0x3b6fb8 });
    if (EARTH_MAP.src) {
      loader.load(EARTH_MAP.src, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        earthMat.map = t;
        earthMat.color.set(0xffffff);
        earthMat.needsUpdate = true;
      });
    }
    const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 48, 32), earthMat);
    earthSpin.add(earth);
    // 관측자(서울)와 천정 방향
    const lat = OBSERVER.lat * D2R;
    const lon = OBSERVER.lon * D2R;
    const obsDir = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    const obs = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0x6fd39a }));
    obs.position.copy(obsDir).multiplyScalar(EARTH_R * 1.01);
    earthSpin.add(obs);
    const zen = arrowMesh(0x6fd39a, 1.6, 0.35, 0.035);
    zen.position.copy(obsDir).multiplyScalar(EARTH_R);
    zen.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), obsDir);
    earthSpin.add(zen);
    earthTilt.add(earthSpin);
    // 자전축과 자전 방향
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, EARTH_R * 3.2, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    earthTilt.add(axis);
    const spinArrow = curvedArrow(EARTH_R * 0.75, 0xffd66b, 200, 470, 0.035);
    spinArrow.position.y = EARTH_R * 1.25;
    earthTilt.add(spinArrow);
    const earthGroup = new THREE.Group();
    earthGroup.add(earthTilt);
    scene.add(earthGroup);

    // 밤하늘 방향(태양 반대쪽)
    const nightArrow = arrowMesh(0xc9a2ff, 7, 0.9, 0.09);
    scene.add(nightArrow);

    // 비교용 지구(희미하게)
    const ghostMeshes = [];

    // 하늘 방향 표시: 은하 중심·반대 방향
    const gc = galToEq(0, 0);
    const ac = galToEq(180, 0);
    const gcDir = eqToScene(gc.ra, gc.dec);
    const acDir = eqToScene(ac.ra, ac.dec);
    const dirLine = (dir, color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([dir.clone().multiplyScalar(2), dir.clone().multiplyScalar(SKY_R * 0.9)]);
      const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 1.2, transparent: true, opacity: 0.8 }));
      l.computeLineDistances();
      scene.add(l);
      return l;
    };
    dirLine(gcDir, 0xffc46b);
    dirLine(acDir, 0x7fd0ff);

    Object.assign(s, { renderer, scene, camera, controls, earthGroup, earthTilt, earthSpin, nightArrow, ghostMeshes, obs, mode: props.current.follow ? 'follow' : 'overview' });
    if (props.current.follow) {
      camera.position.copy(followPose(props.current.date));
      controls.target.copy(earthPos(props.current.date));
      controls.minDistance = 2.2;
    }

    // 글씨표
    const mk = (cls, html, color) => {
      const el = document.createElement('div');
      el.className = `lbl ${cls}`;
      el.style.setProperty('--c', color);
      el.innerHTML = html;
      lbl.current.appendChild(el);
      return el;
    };
    const L = {
      sun: mk('big', '태양', 'var(--c-sun)'),
      earth: mk('', '지구', 'var(--accent)'),
      axis: mk('small', '자전축(23.5° 기울어짐)', '#fff'),
      spin: mk('small', '자전 방향', '#ffd66b'),
      obs: mk('small', '관측자(서울)', '#6fd39a'),
      night: mk('', '밤하늘 방향', '#c9a2ff'),
      gc: mk('big', '은하 중심 방향<br><small>궁수자리 · 별이 많음</small>', 'var(--c-bulge)'),
      ac: mk('big', '은하 중심 반대 방향<br><small>황소·마차부자리 · 별이 적음</small>', 'var(--c-winter)'),
      rev: mk('small', '공전 방향', '#8cc8ff'),
    };
    const seasonLbl = [
      ['봄', 4, 15, 'var(--c-spring)'], ['여름', 7, 15, 'var(--c-summer)'], ['가을', 10, 15, 'var(--c-autumn)'], ['겨울', 1, 15, 'var(--c-winter)'],
    ].map(([t, m, d, c]) => {
      const lam = sunEclipticLon(new Date(Date.UTC(2026, m - 1, d, 3))) + 180;
      return { el: mk('', `${t}<br><small>${m}월 중순</small>`, c), pos: eclToScene(lam, 0, ORBIT_R * 1.25), lam };
    });
    const constLbl = CONST_NAMES.filter(([ab]) => ['Sgr', 'Sco', 'Tau', 'Gem', 'Ori', 'Cyg', 'Leo', 'Vir', 'Aqr', 'Psc', 'Cap', 'Lib', 'Ari', 'Cnc', 'Aur', 'Cas', 'Aql', 'Lyr', 'CMa'].includes(ab)).map(([ab, ko, ra, dec]) => ({
      el: mk('small', NAME_FIX[ab] || ko, 'rgba(190,210,255,.95)'),
      pos: eqToScene(ra, dec, SKY_R * 0.8),
    }));
    s.labels = { L, seasonLbl, constLbl };

    const resize = () => {
      const r = wrap.current.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
      s.w = r.width;
      s.h = r.height;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);
    resize();
    cvs.current.addEventListener('pointerdown', () => {
      if (s.anim) {
        camera.position.copy(s.anim.to);
        controls.target.copy(s.anim.tTo);
        s.anim = null;
      }
    });

    const v = new THREE.Vector3();
    const place = (el, pos, show = true, dy = 0) => {
      if (!show) {
        el.style.opacity = 0;
        return;
      }
      v.copy(pos).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      el.style.opacity = vis ? 1 : 0;
      el.style.transform = `translate(${((v.x + 1) / 2) * s.w}px, ${((1 - v.y) / 2) * s.h + dy}px) translate(-50%, -50%)`;
    };
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const P = props.current;
      const d = P.date;
      const sunLam = sunEclipticLon(d);
      const eLam = sunLam + 180;
      const ePos = eclToScene(eLam, 0, ORBIT_R);
      earthGroup.position.copy(ePos);
      earthSpin.rotation.y = gmstDeg(d) * D2R;
      const anti = ePos.clone().normalize();
      nightArrow.position.copy(ePos).addScaledVector(anti, EARTH_R * 1.05);
      nightArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), anti);
      nightArrow.visible = !P.follow;
      nightArrow.scale.set(1, s.mode === 'night' ? 3.2 : 1, 1);
      orbitLine.visible = !P.follow;
      revArrows.visible = !P.follow;
      // 비교용 지구
      while (ghostMeshes.length < P.ghosts.length) {
        const gm = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 0.9, 32, 20), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
        const ar = arrowMesh(0xffffff, 6.5, 0.9, 0.09);
        gm.add(ball, ar);
        gm.userData = { ball, ar, el: mk('', '', '#fff') };
        scene.add(gm);
        ghostMeshes.push(gm);
      }
      ghostMeshes.forEach((gm, i) => {
        const G = P.ghosts[i];
        gm.visible = !!G;
        gm.userData.el.style.opacity = G ? 1 : 0;
        if (!G) return;
        const lam = sunEclipticLon(G.date) + 180;
        const pos = eclToScene(lam, 0, ORBIT_R);
        const dir = pos.clone().normalize();
        gm.position.copy(pos);
        gm.userData.ball.material.color.set(G.color);
        gm.userData.ar.children.forEach((c) => c.material.color.set(G.color));
        gm.userData.ar.position.copy(dir).multiplyScalar(EARTH_R);
        gm.userData.ar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        gm.userData.el.innerHTML = G.label;
        gm.userData.el.style.setProperty('--c', G.color);
        place(gm.userData.el, pos.clone().add(new THREE.Vector3(0, 2.1, 0)));
      });
      // 카메라
      if (s.anim) {
        const t = Math.min(1, (performance.now() - s.anim.t0) / 1200);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(s.anim.from, s.anim.to, k);
        controls.target.lerpVectors(s.anim.tFrom, s.anim.tTo, k);
        camera.lookAt(controls.target);
        if (t >= 1) {
          s.anim = null;
          controls.update();
        }
      } else {
        if (s.mode !== 'overview' && s.lastE) {
          // 지구를 따라 움직임
          const delta = ePos.clone().sub(s.lastE);
          camera.position.add(delta);
          controls.target.add(delta);
        }
        controls.update();
      }
      s.lastE = ePos.clone();
      sky.visible = P.showSky;
      renderer.render(scene, camera);
      // 글씨
      const on = P.labels;
      place(L.sun, new THREE.Vector3(0, 2.6, 0), on);
      place(L.earth, ePos.clone().add(new THREE.Vector3(0, -1.9, 0)), on && !P.follow);
      const pole = new THREE.Vector3(0, Math.cos(OBLIQUITY * D2R), -Math.sin(OBLIQUITY * D2R));
      place(L.axis, ePos.clone().addScaledVector(pole, EARTH_R * 1.9), on);
      place(L.spin, ePos.clone().addScaledVector(pole, EARTH_R * 1.25).add(new THREE.Vector3(1.2, 0, 0)), on && P.follow);
      const obsW = new THREE.Vector3();
      s.obs.getWorldPosition(obsW);
      place(L.obs, obsW.clone().add(obsW.clone().sub(ePos).normalize().multiplyScalar(0.9)), on && P.follow);
      place(L.night, ePos.clone().addScaledVector(anti, s.mode === 'night' ? 12 : 7.2), on && !P.follow);
      place(L.gc, gcDir.clone().multiplyScalar(SKY_R * 0.7), on);
      place(L.ac, acDir.clone().multiplyScalar(SKY_R * 0.7), on);
      place(L.rev, eclToScene(eLam + 25, 0, ORBIT_R * 1.12), on && !P.follow);
      seasonLbl.forEach((sl) => {
        const far = Math.abs(((sl.lam - eLam + 540) % 360) - 180) > 22;
        place(sl.el, sl.pos, on && P.seasonMarks && !P.follow && far && s.mode !== 'night');
      });
      constLbl.forEach((c) => place(c.el, c.pos, on && P.showSky));
    };
    tick();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      lbl.current && (lbl.current.innerHTML = '');
      Object.keys(s).forEach((k) => delete s[k]);
    };
  }, []);

  if (failed) return <div className="fill" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>이 기기에서는 3D 그래픽(WebGL)을 쓸 수 없어요.</div>;
  return (
    <div ref={wrap} className="fill">
      <canvas ref={cvs} className="fill grab" aria-label="태양 둘레를 도는 지구. 끌어서 돌리고 휠로 확대" />
      <div ref={lbl} className="labels" />
    </div>
  );
});

export default OrbitView;

/** 날짜의 ‘밤하늘 방향(태양 반대쪽)’에 있는 황도 별자리 */
export function nightConstellation(date) {
  return constellationOnEcliptic((sunEclipticLon(date) + 180) % 360);
}
export { eclToEq };
