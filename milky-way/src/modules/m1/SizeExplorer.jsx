import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { ARMS, LOCAL_OBJECTS, NEAR_STARS, R_SUN, armRadius, helioToModel, makeGalaxyCanvas, polarToXY } from '../../lib/galaxy.js';
import { useCanvasSize, lyText } from '../../components/ui.jsx';

export const AU = 1.5813e-5; // 1 천문단위 = 광년
export const LOGW_MIN = Math.log10(0.0006);
export const LOGW_MAX = Math.log10(260000);
export const PRESETS = [
  { id: 'solar', label: '태양계', w: 0.0016, key: 'm1.size.sun' },
  { id: 'near', label: '가까운 별', w: 18 },
  { id: 'local', label: '성단·성운', w: 4000 },
  { id: 'center', label: '은하 중심까지', w: 64000 },
  { id: 'galaxy', label: '은하 지름', w: 128000, key: 'm1.size.galaxy' },
];

const PLANETS = [
  ['수성', 0.387], ['금성', 0.723], ['지구', 1], ['화성', 1.524], ['목성', 5.203], ['토성', 9.537], ['천왕성', 19.19], ['해왕성', 30.07],
];
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const band = (x, a, b, c, d) => Math.min(smooth(a, b, x), 1 - smooth(c, d, x));

function niceLen(maxLy) {
  const e = Math.floor(Math.log10(maxLy));
  for (const m of [5, 2, 1]) if (m * 10 ** e <= maxLy) return m * 10 ** e;
  return 10 ** e;
}

const SizeExplorer = forwardRef(function SizeExplorer({ logW, setLogW, onAction }, ref) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const size = useCanvasSize(wrap);
  const anim = useRef(null);
  const tex = useMemo(() => {
    try {
      return {
        big: makeGalaxyCanvas({ size: 2048, extent: 56 }),
        near: makeGalaxyCanvas({ size: 1536, extent: 9, center: [0, -R_SUN], seed: 21 }),
      };
    } catch {
      return null;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo(w) {
      const from = logWRef.current;
      const to = Math.log10(w);
      const t0 = performance.now();
      const dur = 900 + 160 * Math.abs(to - from);
      cancelAnimationFrame(anim.current);
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / dur);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setLogW(from + (to - from) * k);
        if (t < 1) anim.current = requestAnimationFrame(step);
      };
      step();
    },
  }));
  const logWRef = useRef(logW);
  logWRef.current = logW;
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // 휠·두 손가락 확대
  useEffect(() => {
    const el = cv.current;
    const pts = new Map();
    let pinch = null;
    const wheel = (e) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      setLogW(Math.min(LOGW_MAX, Math.max(LOGW_MIN, logWRef.current + e.deltaY * 0.0016)));
      onAction?.('zoom');
    };
    const down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: logWRef.current };
      }
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        setLogW(Math.min(LOGW_MAX, Math.max(LOGW_MIN, pinch.w - Math.log10(d / pinch.d) * 2)));
        onAction?.('zoom');
      } else if (pts.size === 1) {
        // 한 손가락 위아래 끌기 = 확대/축소
        const dy = e.clientY - prev.y;
        setLogW(Math.min(LOGW_MAX, Math.max(LOGW_MIN, logWRef.current + dy * 0.008)));
      }
    };
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [setLogW, onAction]);

  useEffect(() => {
    const c = cv.current;
    const { w, h, dpr } = size;
    if (!w) return;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#03081a';
    g.fillRect(0, 0, w, h);
    const W = 10 ** logW; // 화면 가로 = W 광년
    const k = w / W; // 광년당 픽셀
    const sun = [0, -R_SUN * 1000];
    const t = smooth(Math.log10(30000), Math.log10(115000), Math.log10(W));
    const cx = sun[0] * (1 - t);
    // 수천 광년 축척에서는 태양 주변 천체(오리온자리 쪽)가 화면에 들어오도록 살짝 아래로
    const cy = sun[1] * (1 - t) - 0.12 * W * band(W, 600, 1500, 8000, 20000);
    const P = (x, y) => [w / 2 + (x - cx) * k, h / 2 - (y - cy) * k];
    const font = (s, wgt = 650) => `${wgt} ${s}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    const label = (txt, x, y, color, s = 14, align = 'center', wgt = 650) => {
      g.font = font(s, wgt);
      g.textAlign = align;
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(3,8,26,.85)';
      g.strokeText(txt, x, y);
      g.fillStyle = color;
      g.fillText(txt, x, y);
    };

    // 1) 은하 그림
    if (tex) {
      const aBig = smooth(2500, 12000, W);
      if (aBig > 0) {
        const [x0, y0] = P(-56000, 56000);
        const s = 112000 * k;
        g.globalAlpha = aBig;
        g.drawImage(tex.big, x0, y0, s, s);
      }
      const aNear = band(W, 250, 1200, 9000, 30000);
      if (aNear > 0) {
        const [x0, y0] = P(-9000, -R_SUN * 1000 + 9000);
        const s = 18000 * k;
        g.globalAlpha = aNear * 0.95;
        g.drawImage(tex.near, x0, y0, s, s);
      }
      g.globalAlpha = 1;
    }

    // 2) 나선팔 이름
    const aArm = band(W, 9000, 22000, 400000, 500000);
    if (aArm > 0) {
      g.globalAlpha = aArm;
      ARMS.forEach((a) =>
        a.labels.forEach((l) => {
          const [x, y] = polarToXY(armRadius(a, l.beta) * 1000, l.beta);
          const [X, Y] = P(x, y);
          label(l.text, X, Y, a.local ? '#ffe9a8' : '#a9d6ff', 13, 'center', 600);
        }),
      );
      g.globalAlpha = 1;
    }

    // 3) 주요 길이
    const aCenter = band(W, 14000, 30000, 300000, 400000);
    if (aCenter > 0) {
      const [X1, Y1] = P(0, 0);
      const [X2, Y2] = P(sun[0], sun[1]);
      g.globalAlpha = aCenter;
      g.setLineDash([7, 6]);
      g.strokeStyle = '#ffe14d';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(X1, Y1);
      g.lineTo(X2, Y2);
      g.stroke();
      g.setLineDash([]);
      label('태양 ↔ 은하 중심: 약 2만 6천 광년', (X1 + X2) / 2 + 12, (Y1 + Y2) / 2, '#ffe14d', 14, 'left');
      label('은하 중심', X1, Y1 - 16, '#ffc46b', 13);
      g.globalAlpha = 1;
    }
    const aDia = smooth(60000, 110000, W);
    if (aDia > 0) {
      const [X1, Y1] = P(-50000, 0);
      const [X2] = P(50000, 0);
      const yy = Math.min(h - 120, Y1 + 50000 * k + 22);
      g.globalAlpha = aDia;
      g.strokeStyle = '#b3bfff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(X1, yy);
      g.lineTo(X2, yy);
      g.moveTo(X1, yy - 7);
      g.lineTo(X1, yy + 7);
      g.moveTo(X2, yy - 7);
      g.lineTo(X2, yy + 7);
      g.stroke();
      label('우리 은하 지름: 약 10만 광년', (X1 + X2) / 2, yy - 14, '#dfe5ff', 15);
      g.globalAlpha = 1;
    }
    const aHalo = smooth(140000, 230000, W);
    if (aHalo > 0) {
      const [X, Y] = P(0, 0);
      g.globalAlpha = aHalo * 0.8;
      g.strokeStyle = '#c9a2ff';
      g.setLineDash([3, 6]);
      g.beginPath();
      g.arc(X, Y, 100000 * k, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      label('헤일로(지름 약 20만 광년 이상, 경계가 흐릿함)', X, Y - 100000 * k + 18, '#d9c2ff', 13);
      g.globalAlpha = 1;
    }

    // 4) 태양 주변의 성단·성운·별
    const aLocal = band(W, 250, 700, 9000, 22000);
    if (aLocal > 0) {
      g.globalAlpha = aLocal;
      LOCAL_OBJECTS.forEach((o) => {
        const [x, y] = o.xyz;
        const [X, Y] = P(x * 1000, y * 1000);
        if (X < -50 || X > w + 50 || Y < -20 || Y > h + 20) return;
        const col = { open: '#8fd0ff', emission: '#ff7aa2', dark: '#d8b48c', star: '#ffe6b0' }[o.kind];
        g.fillStyle = col;
        g.beginPath();
        g.arc(X, Y, 4, 0, Math.PI * 2);
        g.fill();
        label(`${o.name} (${o.d.toLocaleString('ko-KR')}광년)`, X + 8, Y, col, 12.5, 'left', 600);
      });
      g.globalAlpha = 1;
    }
    const aNearStars = band(W, 2, 6, 120, 400);
    if (aNearStars > 0) {
      g.globalAlpha = aNearStars;
      NEAR_STARS.forEach((o) => {
        const [x, y] = helioToModel(o.l, o.b, o.d);
        const [X, Y] = P(x * 1000, y * 1000);
        g.fillStyle = '#e8eeff';
        g.beginPath();
        g.arc(X, Y, 3.5, 0, Math.PI * 2);
        g.fill();
        label(`${o.name} ${o.d}광년`, X + 8, Y, '#e8eeff', 12.5, 'left', 600);
      });
      g.globalAlpha = 1;
    }

    // 5) 태양계: 행성 궤도와 오르트 구름
    const [SX, SY] = P(sun[0], sun[1]);
    const aOort = band(W, 0.015, 0.06, 15, 60);
    if (aOort > 0) {
      g.globalAlpha = aOort * 0.6;
      const r1 = 2000 * AU * k;
      const r2 = 100000 * AU * k;
      const grd = g.createRadialGradient(SX, SY, r1, SX, SY, r2);
      grd.addColorStop(0, 'rgba(160,190,255,0.25)');
      grd.addColorStop(1, 'rgba(160,190,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(SX, SY, r2, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = aOort;
      label('오르트 구름(혜성의 고향, 추정): 약 1~2광년까지', SX, SY - Math.min(r2 * 0.75, h * 0.38), '#c6d6ff', 13);
      g.globalAlpha = 1;
    }
    const aPlan = 1 - smooth(0.004, 0.02, W);
    if (aPlan > 0) {
      g.globalAlpha = aPlan;
      PLANETS.forEach(([n, a], i) => {
        const r = a * AU * k;
        if (r < 3) return;
        g.strokeStyle = i === 7 ? 'rgba(124,196,255,.95)' : 'rgba(170,195,255,.45)';
        g.lineWidth = i === 7 ? 2 : 1;
        g.beginPath();
        g.arc(SX, SY, r, 0, Math.PI * 2);
        g.stroke();
        if (r > 26 && (i >= 4 || r > 60)) label(n, SX + r * 0.7071 + 4, SY - r * 0.7071 - 6, i === 7 ? '#a9d6ff' : '#c9d4f0', 12.5, 'left', 600);
      });
      const rN = 30.07 * AU * k;
      label('해왕성 궤도 지름 약 60 AU ≈ 0.001광년 (빛으로 약 8시간)', SX, Math.min(h - 118, SY + rN + 22), '#a9d6ff', 14);
      g.globalAlpha = 1;
    }
    // 태양(위치 표시)
    g.fillStyle = '#ffe14d';
    g.shadowColor = '#ffe14d';
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(SX, SY, 5, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    label(W < 0.02 ? '태양' : '태양계', SX, SY - 16, '#ffe14d', 14);

    // 6) 축척 막대
    const L = niceLen(W * 0.28);
    const px = L * k;
    const bx = 22;
    const by = h - 30;
    g.strokeStyle = '#f4f7ff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bx, by - 6);
    g.lineTo(bx, by);
    g.lineTo(bx + px, by);
    g.lineTo(bx + px, by - 6);
    g.stroke();
    const lenTxt = L < 0.01 ? `${Math.round(L / AU).toLocaleString('ko-KR')} AU` : lyText(L).replace(/ \(.*\)/, '');
    label(lenTxt, bx + px / 2, by - 16, '#f4f7ff', 13.5);
  }, [size, logW, tex]);

  return (
    <div ref={wrap} className="fill">
      <canvas ref={cv} className="fill grab" aria-label="크기 비교 화면. 휠, 두 손가락, 위아래 끌기로 확대·축소" />
    </div>
  );
});

export default SizeExplorer;
