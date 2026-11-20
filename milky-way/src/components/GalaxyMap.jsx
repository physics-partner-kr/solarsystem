import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { R_SUN, makeGalaxyCanvas, rng, surfaceDensity } from '../lib/galaxy.js';
import { useCanvasSize } from './ui.jsx';

// 위에서 내려다본 우리은하 지도(2D). 확대·이동·클릭 가능. 단위: kly(1000광년)
let TEX = null;
function textures() {
  if (!TEX) {
    try {
      TEX = {
        big: makeGalaxyCanvas({ size: 2048, extent: 56 }),
        near: makeGalaxyCanvas({ size: 1536, extent: 9, center: [0, -R_SUN], seed: 21 }),
      };
    } catch {
      TEX = { big: null, near: null };
    }
  }
  return TEX;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const font = (s, w = 650) => `${w} ${s}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
export function label(g, txt, x, y, color, s = 14, align = 'center', w = 650) {
  g.font = font(s, w);
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(3,8,26,.88)';
  g.strokeText(txt, x, y);
  g.fillStyle = color;
  g.fillText(txt, x, y);
}

const GalaxyMap = forwardRef(function GalaxyMap({ view, setView, draw, onPick, onGesture, interactive = true, frame = 0 }, ref) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const size = useCanvasSize(wrap);
  const tex = useMemo(textures, []);
  const anim = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  useImperativeHandle(ref, () => ({
    flyTo(to, dur = 1400) {
      cancelAnimationFrame(anim.current);
      const from = { ...viewRef.current };
      const t0 = performance.now();
      const lf = Math.log(from.w);
      const lt = Math.log(to.w);
      return new Promise((resolve) => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / dur);
          const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          setView({ cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, w: Math.exp(lf + (lt - lf) * k) });
          if (t < 1) anim.current = requestAnimationFrame(step);
          else resolve();
        };
        step();
      });
    },
    stop() {
      cancelAnimationFrame(anim.current);
    },
  }));
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // 끌기·확대 조작
  useEffect(() => {
    if (!interactive) return undefined;
    const el = cv.current;
    const pts = new Map();
    let start = null;
    let pinch = null;
    const toModel = (cx, cy) => {
      const r = el.getBoundingClientRect();
      const v = viewRef.current;
      const k = r.width / v.w;
      return [v.cx + (cx - r.left - r.width / 2) / k, v.cy - (cy - r.top - r.height / 2) / k];
    };
    const clampW = (w) => Math.min(170, Math.max(0.6, w));
    const wheel = (e) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const v = viewRef.current;
      const f = Math.exp(e.deltaY * 0.0016);
      const w = clampW(v.w * f);
      const [mx, my] = toModel(e.clientX, e.clientY);
      const s = w / v.w;
      setView({ cx: mx + (v.cx - mx) * s, cy: my + (v.cy - my) * s, w });
      onGesture?.('zoom');
    };
    const down = (e) => {
      cancelAnimationFrame(anim.current);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, v: { ...viewRef.current }, t: performance.now(), moved: false };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), v: { ...viewRef.current } };
        start = null;
      }
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        setView({ ...pinch.v, w: clampW((pinch.v.w * pinch.d) / Math.max(10, d)) });
        onGesture?.('zoom');
      } else if (start) {
        const r = el.getBoundingClientRect();
        const k = r.width / start.v.w;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > 6) start.moved = true;
        if (start.moved) {
          setView({ ...start.v, cx: start.v.cx - dx / k, cy: start.v.cy + dy / k });
          onGesture?.('pan');
        }
      }
    };
    const up = (e) => {
      if (start && !start.moved && pts.size === 1) {
        const [x, y] = toModel(e.clientX, e.clientY);
        onPick?.(x, y);
      }
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) start = null;
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
  }, [interactive, setView, onPick, onGesture]);

  useEffect(() => {
    const c = cv.current;
    const { w, h, dpr } = size;
    if (!w) return;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#03081a';
    g.fillRect(0, 0, w, h);
    const k = w / view.w;
    const P = (x, y) => [w / 2 + (x - view.cx) * k, h / 2 - (y - view.cy) * k];
    if (tex.big) {
      const [x0, y0] = P(-56, 56);
      g.globalAlpha = 1;
      g.drawImage(tex.big, x0, y0, 112 * k, 112 * k);
      const aNear = smooth(30, 12, view.w);
      if (aNear > 0) {
        const [x1, y1] = P(-9, -R_SUN + 9);
        g.globalAlpha = aNear;
        g.drawImage(tex.near, x1, y1, 18 * k, 18 * k);
      }
      g.globalAlpha = 1;
    }
    // 확대했을 때: 별 알갱이
    if (view.w < 14) {
      const cell = 0.4;
      const a = smooth(14, 6, view.w);
      const x0 = Math.floor((view.cx - view.w / 2) / cell) - 1;
      const x1 = Math.ceil((view.cx + view.w / 2) / cell) + 1;
      const hh = (view.w * h) / w;
      const y0 = Math.floor((view.cy - hh / 2) / cell) - 1;
      const y1 = Math.ceil((view.cy + hh / 2) / cell) + 1;
      g.globalCompositeOperation = 'lighter';
      for (let i = x0; i <= x1; i++) {
        for (let j = y0; j <= y1; j++) {
          const R = rng((i * 73856093) ^ (j * 19349663));
          const d = surfaceDensity((i + 0.5) * cell, (j + 0.5) * cell);
          const n = Math.min(40, Math.round(d * 60 + R() * 1.5));
          for (let s = 0; s < n; s++) {
            const [X, Y] = P((i + R()) * cell, (j + R()) * cell);
            const m = Math.pow(R(), 3);
            g.globalAlpha = a * (0.3 + m * 0.7);
            g.fillStyle = R() < 0.3 ? '#ffe2c0' : R() < 0.5 ? '#c8d8ff' : '#ffffff';
            const z = 0.8 + m * 2.2;
            g.fillRect(X - z / 2, Y - z / 2, z, z);
          }
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    draw?.(g, { P, k, w, h, view });
  }, [size, view, tex, draw, frame]);

  return (
    <div ref={wrap} className="fill">
      <canvas ref={cv} className={`fill ${interactive ? 'grab' : ''}`} aria-label="위에서 내려다본 우리은하 지도. 끌어서 이동, 휠·두 손가락으로 확대" />
    </div>
  );
});

export default GalaxyMap;
