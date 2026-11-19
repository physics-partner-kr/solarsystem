import { useEffect, useMemo, useRef } from 'react';
import { rng } from '../../lib/galaxy.js';
import { useCanvasSize } from '../../components/ui.jsx';

// 성단 모형 (단위: 광년). 별 수는 줄여서 그리고, 실제 별 수로 환산해 밀도를 보여 준다.
export const CLUSTER_MODELS = {
  open: { name: '산개 성단', real: 1000, a: 7, rmax: 30, n: 420, n2: 420 },
  globular: { name: '구상 성단', real: 300000, a: 8.6, rmax: 72, n: 16000, n2: 8000 },
};

function buildCluster(type, small) {
  const M = CLUSTER_MODELS[type];
  const R = rng(type === 'open' ? 45 : 13);
  const n = small ? M.n2 : M.n;
  const pts = [];
  while (pts.length < n) {
    // 플러머 분포: 중심에 몰리고 바깥으로 갈수록 드물어짐
    const u = Math.max(1e-6, R());
    const r = M.a / Math.sqrt(Math.pow(u, -2 / 3) - 1);
    if (r > M.rmax) continue;
    const z = R() * 2 - 1;
    const th = R() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    let x = r * s * Math.cos(th);
    let y = r * s * Math.sin(th);
    let zz = r * z;
    if (type === 'open') {
      // 산개 성단은 불규칙하고 조금 납작
      zz *= 0.75;
      x *= 1.1;
    }
    let col;
    let mag;
    const q = R();
    if (type === 'open') {
      if (q < 0.06) { col = [170, 200, 255]; mag = 0.7 + R() * 0.3; }
      else if (q < 0.3) { col = [225, 235, 255]; mag = 0.35 + R() * 0.3; }
      else if (q < 0.65) { col = [255, 240, 215]; mag = 0.15 + R() * 0.2; }
      else { col = [255, 195, 150]; mag = 0.06 + R() * 0.12; }
    } else {
      if (q < 0.015) { col = [255, 160, 100]; mag = 0.7 + R() * 0.3; } // 적색 거성
      else if (q < 0.04) { col = [185, 205, 255]; mag = 0.45 + R() * 0.2; } // 수평가지의 뜨거운 별
      else if (q < 0.5) { col = [255, 225, 170]; mag = 0.15 + R() * 0.25; }
      else { col = [255, 205, 150]; mag = 0.05 + R() * 0.12; }
    }
    pts.push({ x, y, z: zz, col, mag });
  }
  if (type === 'open') {
    // 밝은 청백색 별 몇 개(플레이아데스의 일곱 자매처럼)
    [[-6, 3, 1], [2, -4, -2], [7, 6, 3], [-2, 9, -1], [9, -3, 2], [-9, -6, 0], [4, 1, 5]].forEach(([x, y, z]) =>
      pts.push({ x, y, z, col: [175, 205, 255], mag: 1.25 }),
    );
  }
  return pts;
}

let SPR = null;
function sprite() {
  if (SPR) return SPR;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.15, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  SPR = c;
  return c;
}

/**
 * @param {'open'|'globular'} type
 * @param {number} lyAcross 화면 짧은 변에 들어갈 길이(광년)
 */
export default function ClusterCanvas({ type, lyAcross, showBox = false, autoRotate = true, label, onDrag }) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const size = useCanvasSize(wrap);
  const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;
  const pts = useMemo(() => buildCluster(type, small), [type, small]);
  const rot = useRef({ yaw: 0.4, pitch: 0.35, drag: null, last: performance.now() });
  const sp = useMemo(() => (typeof document !== 'undefined' ? sprite() : null), []);

  useEffect(() => {
    const el = cv.current;
    const down = (e) => {
      rot.current.drag = { x: e.clientX, y: e.clientY, yaw: rot.current.yaw, pitch: rot.current.pitch };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      const d = rot.current.drag;
      if (!d) return;
      rot.current.yaw = d.yaw + (e.clientX - d.x) * 0.01;
      rot.current.pitch = Math.max(-1.4, Math.min(1.4, d.pitch + (e.clientY - d.y) * 0.01));
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 10) onDrag?.();
    };
    const up = () => (rot.current.drag = null);
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
  }, [onDrag]);

  useEffect(() => {
    const c = cv.current;
    const { w, h, dpr } = size;
    if (!w) return undefined;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    const M = CLUSTER_MODELS[type];
    const scale = Math.min(w, h) / lyAcross; // px / 광년
    // 별 밝기: 화면에 들어온 별의 밀도에 맞게(별이 많으면 하나하나는 어둡게)
    const fluxScale = type === 'globular' ? 0.75 : 1;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const st = rot.current;
      if (autoRotate && !st.drag) st.yaw += (now - st.last) * 0.00012;
      st.last = now;
      const cy = Math.cos(st.yaw);
      const sy = Math.sin(st.yaw);
      const cp = Math.cos(st.pitch);
      const spi = Math.sin(st.pitch);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#02050f';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      const ox = w / 2;
      const oy = h / 2;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const x1 = p.x * cy - p.z * sy;
        const z1 = p.x * sy + p.z * cy;
        const y1 = p.y * cp - z1 * spi;
        const X = ox + x1 * scale;
        const Y = oy - y1 * scale;
        if (X < -10 || X > w + 10 || Y < -10 || Y > h + 10) continue;
        const m = p.mag;
        const [r, gg, b] = p.col;
        if (m > 0.6 && sp) {
          const s = (type === 'open' ? 26 : 12) * m * Math.min(1.6, Math.max(0.7, scale / 6));
          g.globalAlpha = Math.min(1, m);
          g.drawImage(sp, X - s / 2, Y - s / 2, s, s);
          g.fillStyle = `rgb(${r},${gg},${b})`;
          g.globalAlpha = 0.9;
          g.beginPath();
          g.arc(X, Y, Math.max(1.2, s * 0.09), 0, Math.PI * 2);
          g.fill();
        } else {
          const s = Math.max(0.9, (type === 'open' ? 3.2 : 1.9) * Math.sqrt(m) * Math.min(1.5, Math.max(0.8, scale / 5)));
          g.globalAlpha = Math.min(1, (0.35 + m) * fluxScale);
          g.fillStyle = `rgb(${r},${gg},${b})`;
          g.fillRect(X - s / 2, Y - s / 2, s, s);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      // 밀도 상자: 한 변 10광년 정육면체
      if (showBox) {
        const hs = 5;
        const V = [];
        for (const a of [-hs, hs]) for (const bb of [-hs, hs]) for (const cc of [-hs, hs]) V.push([a, bb, cc]);
        const P = V.map(([x, y, z]) => {
          const x1 = x * cy - z * sy;
          const z1 = x * sy + z * cy;
          const y1 = y * cp - z1 * spi;
          return [ox + x1 * scale, oy - y1 * scale];
        });
        g.strokeStyle = '#6fd39a';
        g.lineWidth = 2;
        const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
        g.beginPath();
        E.forEach(([a, bb]) => {
          g.moveTo(P[a][0], P[a][1]);
          g.lineTo(P[bb][0], P[bb][1]);
        });
        g.stroke();
      }
      // 축척 막대 10광년
      const L = lyAcross > 120 ? 50 : lyAcross > 40 ? 20 : 10;
      const px = L * scale;
      g.strokeStyle = '#f4f7ff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(16, h - 18);
      g.lineTo(16 + px, h - 18);
      g.moveTo(16, h - 24);
      g.lineTo(16, h - 12);
      g.moveTo(16 + px, h - 24);
      g.lineTo(16 + px, h - 12);
      g.stroke();
      g.font = '600 13px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      g.fillStyle = '#f4f7ff';
      g.textAlign = 'center';
      g.fillText(`${L}광년`, 16 + px / 2, h - 28);
      if (label) {
        g.textAlign = 'left';
        g.font = '700 16px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        g.fillText(label, 16, h - 78);
        g.font = '500 12.5px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        g.fillStyle = '#aebbd8';
        g.fillText(`그림 속 별 ${pts.length.toLocaleString('ko-KR')}개 (실제는 약 ${M.real.toLocaleString('ko-KR')}개)`, 16, h - 58);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, pts, type, lyAcross, showBox, autoRotate, label, sp]);

  return (
    <div ref={wrap} className="fill">
      <canvas ref={cv} className="fill grab" aria-label={`${CLUSTER_MODELS[type].name} 3D 모형, 끌어서 돌리기`} />
    </div>
  );
}

/** 모형으로 어림한 ‘한 변 10광년 정육면체 속 별 수’ */
export function boxCount(type) {
  const M = CLUSTER_MODELS[type];
  const R = rng(99);
  let inside = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const u = Math.max(1e-6, R());
    const r = M.a / Math.sqrt(Math.pow(u, -2 / 3) - 1);
    const z = R() * 2 - 1;
    const th = R() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    const x = r * s * Math.cos(th) * (type === 'open' ? 1.1 : 1);
    const y = r * s * Math.sin(th);
    const zz = r * z * (type === 'open' ? 0.75 : 1);
    if (Math.abs(x) < 5 && Math.abs(y) < 5 && Math.abs(zz) < 5) inside++;
  }
  return Math.round(((inside / N) * M.real) / 10) * 10;
}
