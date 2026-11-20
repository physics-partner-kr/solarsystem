// 사진을 쓸 수 없을 때 대신 그리는 그림(성단·성운). 실제 천체의 특징(색, 모양, 밀도)을 살려 그린다.
import { rng } from './galaxy.js';

function noise2(seed) {
  const R = rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    vals[i] = R();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = sm(x - xi);
    const yf = sm(y - yi);
    const a = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * xf;
    const b = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * xf;
    return a + (b - a) * yf;
  };
  return (x, y, oct = 5) => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      s += amp * n(x * f, y * f);
      f *= 2.03;
      amp *= 0.5;
    }
    return s;
  };
}

function stars(g, w, h, R, n, opt = {}) {
  for (let i = 0; i < n; i++) {
    const x = R() * w;
    const y = R() * h;
    const m = Math.pow(R(), opt.pow || 3);
    const r = 0.4 + m * (opt.big || 2.2);
    const c = R() < 0.3 ? '255,220,190' : R() < 0.5 ? '200,215,255' : '255,255,255';
    g.fillStyle = `rgba(${c},${0.35 + m * 0.65})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

function glowStar(g, x, y, r, color = '200,220,255', spikes = true) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r * 6);
  grd.addColorStop(0, `rgba(255,255,255,1)`);
  grd.addColorStop(0.12, `rgba(${color},0.9)`);
  grd.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r * 6, 0, Math.PI * 2);
  g.fill();
  if (spikes) {
    g.strokeStyle = `rgba(${color},0.55)`;
    g.lineWidth = Math.max(1, r * 0.25);
    g.beginPath();
    g.moveTo(x - r * 9, y);
    g.lineTo(x + r * 9, y);
    g.moveTo(x, y - r * 9);
    g.lineTo(x, y + r * 9);
    g.stroke();
  }
}

function cloud(g, w, h, nz, fn, scale = 3) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const val = nz(u * scale, v * scale);
      const [r, gg, b, a] = fn(u, v, val);
      const i = (y * w + x) * 4;
      const t = a;
      d[i] = d[i] * (1 - t) + r * t;
      d[i + 1] = d[i + 1] * (1 - t) + gg * t;
      d[i + 2] = d[i + 2] * (1 - t) + b * t;
    }
  }
  g.putImageData(img, 0, 0);
}

export function drawArt(kind, w = 640, h = 420) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#02040c';
  g.fillRect(0, 0, w, h);
  const R = rng(kind.length * 97 + 3);
  if (kind === 'pleiades' || kind === 'reflection') {
    stars(g, w, h, R, 500);
    const nz = noise2(7);
    const B = [[0.42, 0.38], [0.55, 0.45], [0.36, 0.55], [0.6, 0.3], [0.48, 0.6], [0.66, 0.52], [0.3, 0.42]];
    cloud(g, w, h, nz, (u, v, n) => {
      let near = 0;
      B.forEach(([x, y]) => (near += Math.exp(-((u - x) ** 2 + ((v - y) * h / w) ** 2) / 0.006)));
      const streak = 0.6 + 0.4 * Math.sin((u + v * 0.6) * 60 + n * 8);
      const a = Math.min(0.85, near * n * streak * 0.9);
      return [90, 140, 255, a];
    }, 4);
    B.forEach(([x, y], i) => glowStar(g, x * w, y * h, i < 3 ? 3.4 : 2.4));
  } else if (kind === 'hyades') {
    stars(g, w, h, R, 700, { pow: 4 });
    const V = [[0.3, 0.3], [0.38, 0.45], [0.45, 0.58], [0.52, 0.66], [0.6, 0.55], [0.66, 0.42], [0.72, 0.3]];
    V.forEach(([x, y]) => glowStar(g, x * w, y * h, 2.4, '255,225,180'));
    glowStar(g, 0.64 * w, 0.62 * h, 4.2, '255,170,110');
  } else if (kind === 'beehive' || kind === 'jewel') {
    stars(g, w, h, R, 600, { pow: 4 });
    const n = kind === 'jewel' ? 60 : 45;
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2;
      const r = Math.pow(R(), 0.8) * Math.min(w, h) * (kind === 'jewel' ? 0.22 : 0.38);
      const col = kind === 'jewel' ? (R() < 0.8 ? '190,215,255' : '255,240,220') : R() < 0.6 ? '255,240,215' : '255,210,160';
      glowStar(g, w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a) * 0.8, 0.8 + R() * (kind === 'jewel' ? 2 : 1.6), col, R() < 0.3);
    }
    if (kind === 'jewel') glowStar(g, w * 0.53, h * 0.47, 3, '255,140,90');
  } else if (kind === 'm13' || kind === 'omega' || kind === 'globular') {
    stars(g, w, h, R, 300);
    const cx = w / 2;
    const cy = h / 2;
    const n = kind === 'omega' ? 26000 : 18000;
    const a = Math.min(w, h) * (kind === 'omega' ? 0.13 : 0.09);
    for (let i = 0; i < n; i++) {
      const u = R();
      const r = a / Math.sqrt(Math.pow(u, -2 / 3) - 1);
      if (r > Math.min(w, h) * 0.6) continue;
      const th = R() * Math.PI * 2;
      const x = cx + r * Math.cos(th);
      const y = cy + r * Math.sin(th);
      const m = Math.pow(R(), 4);
      const col = R() < 0.1 ? '190,210,255' : R() < 0.45 ? '255,200,140' : '255,235,200';
      g.fillStyle = `rgba(${col},${0.25 + m * 0.75})`;
      g.fillRect(x, y, 0.8 + m * 2.4, 0.8 + m * 2.4);
    }
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, a * 2.2);
    grd.addColorStop(0, 'rgba(255,240,210,0.9)');
    grd.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, a * 2.2, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'emission') {
    stars(g, w, h, R, 400);
    const nz = noise2(3);
    cloud(g, w, h, nz, (u, v, n) => {
      const d = Math.hypot(u - 0.5, (v - 0.48) * h / w);
      const env = Math.exp(-d * d / 0.05);
      const core = Math.exp(-d * d / 0.004);
      const a = Math.min(0.95, env * Math.pow(n, 1.6) * 2.2 + core * 0.5);
      const r = 255;
      const gg = 80 + core * 150 + n * 40;
      const b = 120 + core * 110;
      return [r, gg, b, a];
    }, 3.5);
    [[0.5, 0.47], [0.51, 0.49], [0.49, 0.5], [0.505, 0.455]].forEach(([x, y]) => glowStar(g, x * w, y * h, 1.8, '210,230,255', false));
  } else if (['rosette', 'crescent', 'chicken'].includes(kind)) {
    stars(g, w, h, R, 500);
    const nz = noise2(kind.length * 13);
    cloud(g, w, h, nz, (u, v, n) => {
      const x = u - 0.5;
      const y = (v - 0.5) * h / w;
      const d = Math.hypot(x, y);
      let env;
      if (kind === 'rosette') env = Math.exp(-((d - 0.2) ** 2) / 0.01) * (d > 0.07 ? 1 : 0.15);
      else if (kind === 'crescent') env = Math.exp(-((d - 0.18) ** 2) / 0.0015) * (0.25 + 0.75 * Math.max(0, Math.cos(Math.atan2(y, x) - 2.3)));
      else env = Math.exp(-((x + 0.12) ** 2 + y * y) / 0.012) + 0.8 * Math.exp(-((x - 0.15) ** 2 + (y + 0.05) ** 2) / 0.008);
      const a = Math.min(0.92, env * Math.pow(n, 1.3) * 2.2);
      return [255, 70 + n * 50, 95 + n * 30, a];
    }, 4);
    if (kind === 'rosette') for (let i = 0; i < 9; i++) glowStar(g, w * (0.46 + R() * 0.08), h * (0.44 + R() * 0.12), 1.6, '200,220,255', false);
    if (kind === 'crescent') glowStar(g, w * 0.5, h * 0.5, 2.2, '220,235,255', false);
  } else if (['iris', 'witch', 'runningman'].includes(kind)) {
    stars(g, w, h, R, 450);
    const nz = noise2(kind.length * 7);
    cloud(g, w, h, nz, (u, v, n) => {
      const x = u - 0.5;
      const y = (v - 0.5) * h / w;
      let env;
      if (kind === 'iris') env = Math.exp(-(x * x + y * y) / 0.02);
      else if (kind === 'witch') env = Math.exp(-((x * 0.45 + y * 0.9) ** 2) / 0.004) * Math.exp(-((x * 0.9 - y * 0.45) ** 2) / 0.09);
      else env = Math.exp(-(x * x + y * y) / 0.04) * (1 - 0.85 * Math.exp(-((x - 0.02) ** 2 / 0.0015 + (y + 0.02) ** 2 / 0.012)));
      const a = Math.min(0.88, env * Math.pow(n, 1.2) * 2.4);
      return [110, 150 + n * 40, 255, a];
    }, 3.5);
    if (kind === 'iris') glowStar(g, w * 0.5, h * 0.5, 3, '255,250,235');
    if (kind === 'witch') glowStar(g, w * 0.93, h * 0.12, 4.5, '200,220,255');
    if (kind === 'runningman') [[0.42, 0.45], [0.58, 0.55]].forEach(([x, y]) => glowStar(g, x * w, y * h, 2.2, '210,225,255'));
  } else if (kind === 'coalsack') {
    stars(g, w, h, R, 4500, { pow: 5, big: 1.8 });
    const nz = noise2(5);
    cloud(g, w, h, nz, (u, v, n) => {
      const d = Math.hypot(u - 0.48, (v - 0.52) * h / w);
      const glow = 0.25 * (1 - Math.abs(v - 0.5));
      const dark = Math.exp(-(d * d) / 0.03) * (0.7 + 0.5 * n);
      return dark > 0.12 ? [6, 5, 8, Math.min(0.97, dark * 1.4)] : [70, 75, 95, glow * n];
    }, 3);
    [[0.18, 0.2], [0.85, 0.3], [0.78, 0.82], [0.12, 0.75]].forEach(([x, y]) => glowStar(g, x * w, y * h, 2.6, '200,220,255'));
  } else if (kind === 'dark') {
    stars(g, w, h, R, 450);
    const nz = noise2(11);
    cloud(g, w, h, nz, (u, v, n) => {
      const glow = Math.exp(-((u - 0.62) ** 2) / 0.05);
      return [235, 70, 95, Math.min(0.85, glow * (0.5 + n * 0.8))];
    }, 3);
    // 말머리 모양 실루엣(간단한 경로)
    g.fillStyle = 'rgba(14,8,10,0.96)';
    g.beginPath();
    const P = [[0, 0.82], [0.25, 0.78], [0.42, 0.74], [0.5, 0.66], [0.47, 0.56], [0.5, 0.46], [0.56, 0.4], [0.62, 0.42], [0.6, 0.5], [0.66, 0.54], [0.62, 0.62], [0.58, 0.7], [0.66, 0.78], [0.8, 0.82], [1, 0.84], [1, 1], [0, 1]];
    P.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
    g.closePath();
    g.fill();
  }
  return c;
}

/** 캔버스를 이미지 주소로 */
export function artURL(kind, w, h) {
  try {
    return drawArt(kind, w, h).toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}
