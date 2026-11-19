import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCanvasSize } from '../../components/ui.jsx';
import { D2R, airmass, galToEq, unit } from '../../lib/astro.js';
import { GLSL_PANO, loadPanorama, makeTexture } from '../../lib/skyTexture.js';
import { BRIGHT_NAMES, NAME_FIX, TRIANGLES, apply, bvColor, makeProjector, skyState, vecToAltAz } from '../../lib/skyMath.js';
import { CONST_LINES, CONST_NAMES, STARS } from '../../data/skyData.js';

// 광공해 단계: 맨눈 한계 등급과 하늘 밝기
export const LIGHT = [
  { id: 0, name: '시골(어두운 하늘)', lim: 6.0, glow: 0.0, mw: 1.0 },
  { id: 1, name: '교외', lim: 4.6, glow: 0.07, mw: 0.33 },
  { id: 2, name: '도시', lim: 3.0, glow: 0.2, mw: 0.04 },
];

const STAR_EQ = (() => {
  const n = STARS.length / 4;
  const v = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = unit(STARS[i * 4], STARS[i * 4 + 1]);
    v[i * 3] = u[0];
    v[i * 3 + 1] = u[1];
    v[i * 3 + 2] = u[2];
  }
  return v;
})();

const FRAG = `
${GLSL_PANO}
uniform mat3 uH2G;
uniform float uMode;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAz0;
uniform float uFovH;
uniform float uAltMin;
uniform float uAltMax;
uniform float uMW;
uniform float uGlow;
uniform float uTwi;
uniform vec3 uSunDir;
uniform float uGain;
varying vec2 vUv;
const float D2R = 0.017453292519943295;
float hill(float az) {
  return 1.2 + 0.9 * sin(az * 3.0 + 1.3) + 0.6 * sin(az * 7.0 + 0.4) + 0.35 * sin(az * 17.0);
}
void main() {
  vec2 px = vUv * uSize;
  float alt; float az;
  if (uMode < 0.5) {
    vec2 d = px - uCenter;
    float r = length(d);
    if (r > uRadius + 1.5) { gl_FragColor = vec4(0.012, 0.03, 0.07, 1.0); return; }
    alt = 90.0 * (1.0 - r / uRadius);
    az = atan(-d.x, d.y) / D2R;
  } else {
    az = uAz0 + (vUv.x - 0.5) * uFovH;
    alt = uAltMin + vUv.y * (uAltMax - uAltMin);
  }
  float ca = cos(alt * D2R);
  vec3 h = vec3(ca * cos(az * D2R), ca * sin(az * D2R), sin(alt * D2R));
  // 땅
  float ground = uMode > 0.5 ? hill(az * D2R) : 0.6;
  if (alt < ground) {
    float city = uGlow * 2.2 * exp(-max(0.0, -alt) / 6.0);
    vec3 g = vec3(0.016, 0.02, 0.028) + vec3(0.09, 0.06, 0.03) * city;
    gl_FragColor = vec4(g, 1.0);
    return;
  }
  vec3 gdir = uH2G * h;
  vec3 col = panoColor(gdir);
  // 대기에 의한 감광(지평선 가까울수록 어두움)
  float s = max(sin(alt * D2R), 0.02);
  float X = 1.0 / (s + 0.025 * exp(-11.0 * s));
  float ext = pow(10.0, -0.4 * 0.28 * (X - 1.0));
  // 하늘 밝기(광공해 + 박명)
  float horizonF = pow(1.0 - clamp(alt / 90.0, 0.0, 1.0), 2.2);
  vec3 lp = vec3(0.32, 0.24, 0.16) * uGlow * (0.35 + 1.6 * horizonF);
  float sd = max(dot(h, uSunDir), 0.0);
  vec3 tw = uTwi * (vec3(0.05, 0.11, 0.24) * (0.45 + 0.8 * horizonF) + vec3(0.28, 0.17, 0.08) * pow(sd, 6.0) * horizonF * 1.4);
  float vis = uMW * ext * clamp(1.0 - uTwi * 1.25, 0.0, 1.0);
  vec3 c = col * vis * uGain + lp + tw + vec3(0.004, 0.008, 0.02);
  gl_FragColor = vec4(c, 1.0);
}`;
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** 박명 정도: 태양 고도 0°→1, -18°→0 */
export function twilightLevel(sunAlt) {
  if (sunAlt >= 0) return 1;
  if (sunAlt <= -18) return 0;
  const t = (sunAlt + 18) / 18;
  return Math.pow(t, 2.2);
}

export default function SkyView({
  date, mode = 'dome', az0 = 180, onAz0, lines = true, names = true, galEq = true, light = 0, twilight = true, compact = false, title, sub, accent = '#fff', onReady,
}) {
  const wrap = useRef(null);
  const gl = useRef(null);
  const ov = useRef(null);
  const size = useCanvasSize(wrap);
  const st = useRef({});
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const sky = useMemo(() => skyState(date), [date]);

  // WebGL 준비
  useEffect(() => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: gl.current, antialias: false, preserveDrawingBuffer: false });
    } catch {
      setFailed(true);
      return undefined;
    }
    const scene = new THREE.Scene();
    const cam = new THREE.Camera();
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPano: { value: null }, uH2G: { value: new THREE.Matrix3() }, uMode: { value: 0 }, uSize: { value: new THREE.Vector2(1, 1) },
        uCenter: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uAz0: { value: 180 }, uFovH: { value: 180 }, uAltMin: { value: -8 },
        uAltMax: { value: 82 }, uMW: { value: 1 }, uGlow: { value: 0 }, uTwi: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uGain: { value: 1.25 },
      },
      depthTest: false,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    st.current = { renderer, scene, cam, mat };
    let alive = true;
    loadPanorama().then(({ image }) => {
      if (!alive) return;
      const t = makeTexture(image);
      mat.uniforms.uPano.value = t;
      st.current.tex = t;
      setReady(true);
      onReady?.();
    });
    return () => {
      alive = false;
      st.current.tex?.dispose();
      mat.dispose();
      renderer.dispose();
      st.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 파노라마: 끌어서 방향 바꾸기
  const az0Ref = useRef(az0);
  az0Ref.current = az0;
  useEffect(() => {
    const el = ov.current;
    if (mode !== 'pano' || !onAz0) return undefined;
    let start = null;
    const down = (e) => {
      start = { x: e.clientX, az: az0Ref.current };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!start) return;
      const r = el.getBoundingClientRect();
      const fov = Math.min(300, (90 * r.width) / r.height);
      onAz0((((start.az - ((e.clientX - start.x) / r.width) * fov) % 360) + 360) % 360);
    };
    const up = () => (start = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [mode, onAz0]);

  // 그리기
  useEffect(() => {
    const { w, h, dpr } = size;
    const S = st.current;
    if (!w || !S.renderer) return;
    const L = LIGHT[light];
    const twi = twilight ? twilightLevel(sky.sunAlt) : 0;
    const proj = makeProjector(mode, w, h, az0);
    // 1) 배경(사진)
    S.renderer.setPixelRatio(dpr);
    S.renderer.setSize(w, h, false);
    const u = S.mat.uniforms;
    const m = sky.H2G;
    u.uH2G.value.set(m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]);
    u.uMode.value = mode === 'dome' ? 0 : 1;
    u.uSize.value.set(w, h);
    if (mode === 'dome') {
      u.uCenter.value.set(proj.cx, h - proj.cy);
      u.uRadius.value = proj.R;
    } else {
      u.uAz0.value = az0;
      u.uFovH.value = proj.fovH;
      u.uAltMin.value = proj.altMin;
      u.uAltMax.value = proj.altMax;
    }
    u.uMW.value = L.mw;
    u.uGlow.value = L.glow;
    u.uTwi.value = twi;
    u.uSunDir.value.set(...sky.sunHor);
    if (u.uPano.value) S.renderer.render(S.scene, S.cam);

    // 2) 별·선·글씨(2D)
    const c = ov.current;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const fs = compact ? 0.85 : 1;
    const F = (s, wt = 650) => `${wt} ${Math.round(s * fs)}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    const text = (t, x, y, color, s = 13, align = 'center', wt = 650) => {
      g.font = F(s, wt);
      g.textAlign = align;
      g.textBaseline = 'middle';
      g.lineWidth = 3.5;
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(2,6,18,.85)';
      g.strokeText(t, x, y);
      g.fillStyle = color;
      g.fillText(t, x, y);
    };
    const toScr = (eqv) => {
      const hv = apply(sky.E2H, eqv);
      const { alt, az } = vecToAltAz(hv);
      return { alt, az, p: proj.fwd(alt, az) };
    };
    const limBase = L.lim - twi * 4.5;
    const scale = Math.max(0.75, Math.min(1.4, Math.min(w, h) / 520));
    // 별자리 선
    if (lines) {
      g.strokeStyle = 'rgba(140,175,255,.45)';
      g.lineWidth = 1.1;
      g.beginPath();
      Object.values(CONST_LINES).forEach((segs) =>
        segs.forEach((seg) => {
          let prev = null;
          for (let i = 0; i < seg.length; i += 2) {
            const r = toScr(unit(seg[i], seg[i + 1]));
            const p = r.alt > -2 ? r.p : null;
            if (p && prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < w * 0.25) {
              g.moveTo(prev[0], prev[1]);
              g.lineTo(p[0], p[1]);
            }
            prev = p;
          }
        }),
      );
      g.stroke();
    }
    // 별
    const n = STARS.length / 4;
    for (let i = 0; i < n; i++) {
      const mag = STARS[i * 4 + 2];
      if (mag > limBase) continue;
      const hv = apply(sky.E2H, [STAR_EQ[i * 3], STAR_EQ[i * 3 + 1], STAR_EQ[i * 3 + 2]]);
      if (hv[2] < 0) continue;
      const { alt, az } = vecToAltAz(hv);
      const p = proj.fwd(alt, az);
      if (!p) continue;
      const ext = 0.28 * (airmass(Math.max(0.5, alt)) - 1);
      const m = mag + ext;
      if (m > limBase + 0.3) continue;
      const r = Math.max(0.55, (2.7 - 0.42 * m) * scale);
      const a = Math.max(0.15, Math.min(1, (limBase + 0.5 - m) / 2.2));
      const [cr, cg, cb] = bvColor(STARS[i * 4 + 3]);
      g.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      g.beginPath();
      g.arc(p[0], p[1], r, 0, Math.PI * 2);
      g.fill();
      if (m < 1.2) {
        g.fillStyle = `rgba(${cr},${cg},${cb},${0.18 * a})`;
        g.beginPath();
        g.arc(p[0], p[1], r * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 은하 적도(은하수의 중심선)와 은하 중심
    if (galEq) {
      g.setLineDash([3, 6]);
      g.strokeStyle = 'rgba(255,200,120,.55)';
      g.lineWidth = 1.5;
      g.beginPath();
      let prev = null;
      for (let l = 0; l <= 360; l += 2) {
        const e = galToEq(l, 0);
        const r = toScr(unit(e.ra, e.dec));
        const p = r.alt > -1 ? r.p : null;
        if (p && prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < w * 0.25) {
          g.moveTo(prev[0], prev[1]);
          g.lineTo(p[0], p[1]);
        }
        prev = p;
      }
      g.stroke();
      g.setLineDash([]);
    }
    const marks = [
      { l: 0, t: '은하 중심 방향', s: '궁수자리', c: '#ffc46b' },
      { l: 180, t: '은하 중심 반대 방향', s: '황소·마차부자리', c: '#7fd0ff' },
    ];
    marks.forEach((mk) => {
      const e = galToEq(mk.l, 0);
      const r = toScr(unit(e.ra, e.dec));
      if (!r.p) return;
      const [x, y] = r.p;
      if (r.alt < 0) {
        // 지평선 아래: 방향만 표시
        if (mode === 'pano' || r.alt > -25) {
          const yy = mode === 'pano' ? h - 18 : y;
          text(`${mk.t}: 지평선 아래`, x, yy, mk.c + 'cc', 11.5, 'center', 600);
        }
        return;
      }
      g.strokeStyle = mk.c;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 10 * scale, 0, Math.PI * 2);
      g.stroke();
      text(mk.t, x, y - 22 * scale, mk.c, 13.5);
      text(`(${mk.s})`, x, y + 22 * scale, mk.c, 11.5, 'center', 600);
    });
    // 대삼각형·별 이름·별자리 이름
    const small = Math.min(w, h) < 380;
    const KEY_STARS = ['베가(직녀성)', '알타이르(견우성)', '데네브', '안타레스', '시리우스', '베텔게우스', '리겔', '카펠라', '북극성'];
    const KEY_CONST = ['Sgr', 'Sco', 'Cyg', 'Aql', 'Lyr', 'Ori', 'Gem', 'Aur', 'Tau', 'Cas', 'CMa'];
    if (names) {
      TRIANGLES.forEach((T) => {
        const P = T.stars.map(([ra, dec]) => toScr(unit(ra, dec)));
        if (P.some((q) => !q.p || q.alt < 2)) return;
        g.strokeStyle = T.color + '99';
        g.setLineDash([6, 5]);
        g.lineWidth = 1.4;
        g.beginPath();
        P.forEach((q, i) => (i ? g.lineTo(q.p[0], q.p[1]) : g.moveTo(q.p[0], q.p[1])));
        g.closePath();
        g.stroke();
        g.setLineDash([]);
        const cx = P.reduce((s, q) => s + q.p[0], 0) / 3;
        const cy = P.reduce((s, q) => s + q.p[1], 0) / 3;
        text(T.name, cx, cy, T.color, 12, 'center', 650);
      });
      BRIGHT_NAMES.forEach(([nm, ra, dec]) => {
        const r = toScr(unit(ra, dec));
        if (!r.p || r.alt < 1 || (small && !KEY_STARS.includes(nm))) return;
        text(nm, r.p[0] + 8, r.p[1] - 9, '#fff3c9', 11.5, 'left', 600);
      });
      CONST_NAMES.forEach(([ab, ko, ra, dec, rank]) => {
        if (rank > 2 && !['Sgr', 'Sct', 'Aql', 'Cyg', 'Cas', 'Per', 'Aur', 'Tau', 'Gem', 'Ori', 'Mon', 'CMa', 'Sco', 'Lyr'].includes(ab)) return;
        if (rank > 1 && !['Sgr', 'Sct', 'Aql', 'Cyg', 'Cas', 'Per', 'Aur', 'Tau', 'Gem', 'Ori', 'Mon', 'CMa', 'Sco', 'Lyr', 'Oph', 'Her', 'UMa', 'Leo', 'Boo', 'Peg', 'Vir'].includes(ab)) return;
        if (small && !KEY_CONST.includes(ab)) return;
        const r = toScr(unit(ra, dec));
        if (!r.p || r.alt < 3) return;
        text(NAME_FIX[ab] || ko, r.p[0], r.p[1], 'rgba(170,200,255,.9)', 12, 'center', 560);
      });
    }
    // 지평선·방위·천정
    if (mode === 'dome') {
      g.strokeStyle = 'rgba(200,215,255,.55)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(proj.cx, proj.cy, proj.R, 0, Math.PI * 2);
      g.stroke();
      [[0, '북'], [90, '동'], [180, '남'], [270, '서']].forEach(([az, t]) => {
        const r = proj.R + 15;
        const x = proj.cx - r * Math.sin(az * D2R);
        const y = proj.cy - r * Math.cos(az * D2R);
        text(t, x, y, '#ffffff', 16, 'center', 800);
      });
      g.strokeStyle = 'rgba(255,255,255,.75)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(proj.cx - 8, proj.cy);
      g.lineTo(proj.cx + 8, proj.cy);
      g.moveTo(proj.cx, proj.cy - 8);
      g.lineTo(proj.cx, proj.cy + 8);
      g.stroke();
      text('천정', proj.cx + 10, proj.cy + 12, '#ffffff', 11.5, 'left', 650);
      text('원의 둘레 = 지평선', w - 8, h - 10, 'rgba(200,215,255,.8)', 11, 'right', 550);
    } else {
      const y0 = proj.fwd(0, az0)[1];
      g.strokeStyle = 'rgba(200,215,255,.6)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, y0);
      g.lineTo(w, y0);
      g.stroke();
      text('지평선', 8, y0 - 10, 'rgba(200,215,255,.85)', 11, 'left', 600);
      [[0, '북'], [45, '북동'], [90, '동'], [135, '남동'], [180, '남'], [225, '남서'], [270, '서'], [315, '북서']].forEach(([az, t]) => {
        const p = proj.fwd(0, az);
        if (p) text(t, p[0], h - 12, '#ffffff', t.length > 1 ? 13 : 16, 'center', 800);
      });
      const z = proj.fwd(90, az0);
      if (z && z[1] > 0) {
        text('▲ 천정(머리 위) 방향', w / 2, 14, '#ffffff', 11.5, 'center', 650);
      }
      [30, 60].forEach((a) => {
        const p = proj.fwd(a, az0 - proj.fovH / 2 + 2);
        if (p) text(`${a}°`, 6, p[1], 'rgba(200,215,255,.6)', 10.5, 'left', 600);
      });
    }
    if (title) {
      text(title, 12, 20, accent, compact ? 15 : 17, 'left', 800);
      if (sub) text(sub, 12, 42, 'rgba(220,228,255,.92)', 12, 'left', 600);
    }
    if (twilight && sky.sunAlt > -18) {
      text(sky.sunAlt > -6 ? '해가 진 지 얼마 안 되어 하늘이 밝아요(박명)' : '아직 하늘이 조금 밝아요(박명)', w / 2, mode === 'dome' ? 16 : 34, '#ffd8a8', 12, 'center', 650);
    }
  }, [size, sky, mode, az0, lines, names, galEq, light, twilight, ready, title, sub, compact, accent]);

  if (failed) {
    return <div className="fill" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-2)', padding: '1rem', textAlign: 'center' }}>이 기기에서는 하늘 그림(WebGL)을 그릴 수 없어요.</div>;
  }
  return (
    <div ref={wrap} className="fill" style={{ background: '#030a1c' }}>
      <canvas ref={gl} className="fill" aria-hidden="true" />
      <canvas ref={ov} className={`fill ${mode === 'pano' && onAz0 ? 'grab' : ''}`} role="img" aria-label={`${title || ''} 밤하늘 모습`} />
    </div>
  );
}
