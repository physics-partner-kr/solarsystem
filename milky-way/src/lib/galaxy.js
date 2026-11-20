// 우리은하 모형 (단위: 1000광년 = 1 kly)
// - 막대나선은하, 원반 지름 약 30000 pc(약 10만 광년), 태양계는 중심에서 약 8500 pc(약 2만 8천 광년) — 교과서 값
// - 나선팔 위치: 태양 근처는 별 탄생 영역 관측(Reid 외, 2019, ApJ 885, 131)의 반지름·감긴 각도를 따르고,
//   은하 반대편은 관측이 어려워 같은 나선 모양을 이어 그린 '추정'이다.
// 좌표: 위(북쪽 은하극)에서 내려다본 평면. 은하 중심 (0,0), 태양 (0, -26). +y가 태양→은하 중심 방향(은경 0°),
//       -x 쪽이 은경 90°(백조자리 방향). 은하는 위에서 보면 시계 방향으로 돈다.

import { D2R, R2D, norm360 } from './astro.js';

export const R_SUN = 27.7; // kly (8500 pc × 3.26)
export const DISK_R = 50; // kly (지름 10만 광년)
export const HALO_R = 100; // kly (지름 20만 광년 이상, 경계가 뚜렷하지 않음)
export const BAR = { half: 13.5, width: 4.2, beta: 27 }; // 길이 약 2만 7천 광년, 태양-중심선과 약 27°
export const BULGE = { a: 6, b: 4.6, c: 5 }; // 팽대부: 두께(위아래) 약 1만 광년
export const DISK_SCALE_H = 0.35; // 얇은 원반의 두께 척도 → 전체 두께 약 1천 광년

const S = R_SUN / 8.15; // 논문(kpc, 태양 8.15 kpc) → 이 모형(kly, 태양 26 kly)

export const ARMS = [
  {
    id: 'perseus', name: '페르세우스자리 팔', R0: 10.1 * S, pitch: 12.6, b0: 203, b1: -100, w: 1.5, major: true,
    labels: [{ beta: 40, text: '페르세우스자리 팔' }, { beta: 150, text: '페르세우스자리 팔' }],
  },
  {
    id: 'scutum', name: '방패자리-센타우루스자리 팔', R0: 5.4 * S, pitch: 13.5, b0: 23, b1: -250, w: 1.5, major: true,
    labels: [{ beta: -70, text: '방패자리-센타우루스자리 팔' }, { beta: -205, text: '방패자리-센타우루스자리 팔' }],
  },
  {
    id: 'sagittarius', name: '궁수자리-용골자리 팔', R0: 6.87 * S, pitch: 13.0, b0: 115, b1: -200, w: 1.15, major: false,
    labels: [{ beta: 32, text: '궁수자리 팔' }, { beta: -55, text: '용골자리 팔' }],
  },
  {
    id: 'norma', name: '직각자자리 팔 · 바깥 팔', R0: 12.4 * S, pitch: 11.6, b0: 295, b1: -45, w: 1.15, major: false,
    labels: [{ beta: 255, text: '직각자자리 팔' }, { beta: 10, text: '바깥 팔' }],
  },
  {
    id: 'local', name: '오리온자리 팔(국부 팔)', R0: 8.33 * S, pitch: 11.4, b0: 30, b1: -16, w: 0.95, major: false, local: true,
    labels: [{ beta: 24, text: '오리온자리 팔' }],
  },
];

export const armRadius = (arm, betaDeg) => arm.R0 * Math.exp(-betaDeg * D2R * Math.tan(arm.pitch * D2R));

/** 은하 중심 기준 극좌표(R, β) → 평면 좌표. β=0은 태양 쪽, β가 커지면 은하 회전 방향(시계 방향) */
export function polarToXY(R, betaDeg) {
  const phi = (-90 - betaDeg) * D2R;
  return [R * Math.cos(phi), R * Math.sin(phi)];
}

export function xyToBeta(x, y) {
  return norm360(-90 - Math.atan2(y, x) * R2D);
}

/** 나선팔 중심선 점들 */
export function armPath(arm, stepDeg = 1) {
  const pts = [];
  const n = Math.ceil(Math.abs(arm.b0 - arm.b1) / stepDeg);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const beta = arm.b0 + (arm.b1 - arm.b0) * t;
    const R = armRadius(arm, beta);
    const [x, y] = polarToXY(R, beta);
    pts.push({ x, y, R, beta, t });
  }
  return pts;
}

// 나선팔 끝이 갑자기 끊기지 않게: 시작(막대 끝)은 서서히, 바깥 끝은 원반 가장자리에서 흐려짐
export function armFade(arm, t, R) {
  const start = Math.min(1, t / (arm.local ? 0.25 : 0.06));
  const end = Math.min(1, (1 - t) / (arm.local ? 0.25 : 0.12));
  const edge = R > DISK_R ? Math.exp(-(R - DISK_R) / 3) : 1;
  return Math.max(0, Math.min(start, end)) * edge;
}

const ARM_PATHS = ARMS.map((a) => armPath(a, 0.5));

/** 점에서 가장 가까운 나선팔과 거리 */
export function nearestArm(x, y) {
  let best = { arm: null, d: Infinity };
  ARMS.forEach((arm, i) => {
    const P = ARM_PATHS[i];
    for (let k = 0; k < P.length; k++) {
      const dx = P[k].x - x;
      const dy = P[k].y - y;
      const d = dx * dx + dy * dy;
      if (d < best.d) best = { arm, d, t: P[k].t, R: P[k].R };
    }
  });
  best.d = Math.sqrt(best.d);
  return best;
}

/** 막대 좌표계(u: 막대 길이 방향, v: 폭 방향) */
export function barFrame(x, y) {
  const [ux, uy] = polarToXY(1, BAR.beta);
  return { u: x * ux + y * uy, v: -x * uy + y * ux };
}

/** 원반 별의 상대적인 면밀도 (지수 원반 + 나선팔 + 막대 + 팽대부) */
export function surfaceDensity(x, y) {
  const R = Math.hypot(x, y);
  const disk = Math.exp(-R / 8.5) * (R > DISK_R ? Math.exp(-(R - DISK_R) / 2.5) : 1);
  const { arm, d, t } = nearestArm(x, y);
  const armBoost = arm ? (arm.major ? 1.3 : 0.9) * Math.exp(-(d * d) / (2 * arm.w * arm.w)) * armFade(arm, t, R) : 0;
  const { u, v } = barFrame(x, y);
  const bar = 2.4 * Math.exp(-((u / BAR.half) ** 4) - ((v / BAR.width) ** 2) * 2.5);
  const bulge = 9 * Math.exp(-(R * R) / (2 * 2.2 * 2.2));
  return disk * (1 + armBoost) + bar * 0.35 + bulge * 0.35;
}

// ───────────────────────── 난수 ─────────────────────────
export function rng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = () => {
    const u = Math.max(1e-9, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return next;
}

// ───────────────────────── 위에서 본 은하 그림(캔버스) ─────────────────────────
function makeSprite(r, g, b, size = 64, hard = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.25 + hard * 0.5, `rgba(${r},${g},${b},${0.45 + hard * 0.4})`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grd;
  x.fillRect(0, 0, size, size);
  return c;
}

let SPRITES = null;
function sprites() {
  if (!SPRITES) {
    SPRITES = {
      blue: makeSprite(150, 190, 255),
      white: makeSprite(235, 238, 255),
      warm: makeSprite(255, 214, 160),
      gold: makeSprite(255, 190, 110),
      pink: makeSprite(255, 110, 150, 64, 0.3),
      dust: makeSprite(70, 45, 30),
      star: makeSprite(255, 255, 255, 16, 0.6),
    };
  }
  return SPRITES;
}

/**
 * 위에서 내려다본 은하 그림을 캔버스로 만든다.
 * @param {object} o size: 픽셀, extent: 중심에서 가장자리까지(kly), center: [x,y](kly)
 */
export function makeGalaxyCanvas({ size = 2048, extent = 56, center = [0, 0], seed = 11, dust = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const k = size / (2 * extent);
  const px = (x, y) => [(x - center[0]) * k + size / 2, size / 2 - (y - center[1]) * k];
  const inView = (x, y, m) => Math.abs(x - center[0]) < extent + m && Math.abs(y - center[1]) < extent + m;
  const R = rng(seed);
  const sp = sprites();
  const blob = (img, x, y, rad, alpha) => {
    if (!inView(x, y, rad * 2)) return;
    const [X, Y] = px(x, y);
    const s = Math.max(1.2, rad * k * 2);
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(img, X - s / 2, Y - s / 2, s, s);
  };

  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';

  // 1) 원반 전체의 은은한 빛(지수 원반)
  {
    const [X, Y] = px(0, 0);
    const grd = g.createRadialGradient(X, Y, 0, X, Y, 54 * k);
    for (let i = 0; i <= 20; i++) {
      const r = (i / 20) * 54;
      const v = Math.exp(-r / 8.5) * (r > DISK_R ? Math.exp(-(r - DISK_R) / 2) : 1);
      const a = i === 20 ? 0 : Math.min(1, 0.7 * v + 0.06 * Math.exp(-r / 30) * Math.max(0, 1 - r / 54));
      const col = r < 12 ? '255,225,180' : r < 25 ? '225,225,245' : '190,205,255';
      grd.addColorStop(i / 20, `rgba(${col},${a.toFixed(3)})`);
    }
    g.globalAlpha = 1;
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }

  // 2) 막대 + 팽대부
  {
    const [X, Y] = px(0, 0);
    g.save();
    g.translate(X, Y);
    g.rotate(-(-90 - BAR.beta) * D2R);
    g.scale(1, BAR.width / BAR.half);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, BAR.half * 1.15 * k);
    grd.addColorStop(0, 'rgba(255,215,150,0.95)');
    grd.addColorStop(0.45, 'rgba(255,200,130,0.55)');
    grd.addColorStop(0.8, 'rgba(255,190,120,0.18)');
    grd.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, BAR.half * 1.15 * k, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const grd2 = g.createRadialGradient(X, Y, 0, X, Y, 7 * k);
    grd2.addColorStop(0, 'rgba(255,245,220,1)');
    grd2.addColorStop(0.3, 'rgba(255,220,160,0.75)');
    grd2.addColorStop(1, 'rgba(255,200,130,0)');
    g.fillStyle = grd2;
    g.fillRect(X - 7 * k, Y - 7 * k, 14 * k, 14 * k);
  }

  // 3) 나선팔: 젊은 파란 별 무리 + 분홍색 별 탄생 영역(HII)
  const densityScale = Math.min(4, Math.max(1, k / 18));
  ARMS.forEach((arm) => {
    const P = armPath(arm, 0.25);
    const per = (arm.major ? 9 : 6.5) * densityScale;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1];
      const b = P[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const fade = armFade(arm, b.t, b.R);
      if (fade <= 0.01) continue;
      const n = Math.round(segLen * per * (0.6 + fade * 0.4));
      for (let j = 0; j < n; j++) {
        const f = R();
        const cx = a.x + (b.x - a.x) * f;
        const cy = a.y + (b.y - a.y) * f;
        const off = R.gauss() * arm.w * 0.75;
        const nx = -(b.y - a.y) / segLen;
        const ny = (b.x - a.x) / segLen;
        const x = cx + nx * off;
        const y = cy + ny * off;
        const big = R() < 0.25;
        blob(big ? sp.blue : sp.white, x, y, (big ? 1.1 : 0.55) * (0.6 + R()), 0.06 * fade * (arm.major ? 1.25 : 1));
        if (R() < 0.035 * (arm.major ? 1.3 : 1)) {
          // 별 탄생 영역(분홍): 작은 덩어리 몇 개로
          const hx = x + R.gauss() * 0.3;
          const hy = y + R.gauss() * 0.3;
          const hr = 0.06 + R() * 0.12;
          for (let q = 0; q < 3; q++) blob(sp.pink, hx + R.gauss() * hr, hy + R.gauss() * hr, hr * (0.6 + R() * 0.8), 0.5 * fade);
        }
        if (R() < 0.06) blob(sp.blue, x, y, Math.max(0.05, 1.6 / k) * (1 + R()), 0.75 * fade);
      }
    }
  });

  // 4) 원반에 흩어진 별(알갱이 느낌)
  {
    const n = Math.round(9000 * densityScale * (extent / 56) ** 0.5);
    for (let i = 0; i < n; i++) {
      const x = center[0] + (R() * 2 - 1) * extent;
      const y = center[1] + (R() * 2 - 1) * extent;
      const d = surfaceDensity(x, y);
      if (R() > d * 0.9) continue;
      const rr = Math.hypot(x, y);
      blob(rr < 14 ? sp.warm : sp.white, x, y, (0.8 + R() * 1.1) / k, 0.45 + R() * 0.45);
    }
  }

  // 5) 먼지 띠: 나선팔 안쪽 가장자리를 따라 어두운 띠
  if (dust) {
    g.globalCompositeOperation = 'multiply';
    ARMS.forEach((arm) => {
      const P = armPath(arm, 0.4);
      const per = 1.6 * densityScale;
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1];
        const b = P[i];
        const fade = armFade(arm, b.t, b.R);
        if (fade <= 0.05) continue;
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.round(segLen * per);
        for (let j = 0; j < n; j++) {
          const f = R();
          const cx = a.x + (b.x - a.x) * f;
          const cy = a.y + (b.y - a.y) * f;
          const Rr = Math.hypot(cx, cy);
          const off = -arm.w * 0.85 + R.gauss() * 0.35; // 안쪽(중심 쪽)
          const x = cx * (1 + off / Rr);
          const y = cy * (1 + off / Rr);
          blob(sp.dust, x, y, 0.35 + R() * 0.5, 0.22 * fade);
        }
      }
    });
    g.globalCompositeOperation = 'source-over';
  }
  // 원반 바깥은 완전히 검게(3D에서 네모난 판이 비치지 않도록)
  {
    const [X, Y] = px(0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'multiply';
    const m = g.createRadialGradient(X, Y, 50 * k, X, Y, 55.5 * k);
    m.addColorStop(0, '#fff');
    m.addColorStop(1, '#000');
    g.fillStyle = m;
    g.fillRect(0, 0, size, size);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

// ───────────────────────── 3D 별 입자 ─────────────────────────
// group: 0 원반, 1 나선팔, 2 팽대부, 3 막대, 4 헤일로, 5 구상 성단
export const GROUP = { disk: 0, arm: 1, bulge: 2, bar: 3, halo: 4, globular: 5 };

function starColor(R, kind) {
  // 대략적인 별 색(나이에 따라): 젊은 별=청백색, 늙은 별=노란·주황
  if (kind === 'young') return R() < 0.5 ? [0.62, 0.75, 1.0] : [0.85, 0.9, 1.0];
  if (kind === 'old') return R() < 0.3 ? [1.0, 0.72, 0.45] : [1.0, 0.86, 0.62];
  return R() < 0.33 ? [0.95, 0.95, 1.0] : R() < 0.6 ? [1.0, 0.9, 0.75] : [0.8, 0.86, 1.0];
}

export function makeGalaxyParticles({ disk = 26000, arm = 22000, bulge = 9000, bar = 5000, halo = 3500, globular = 150, seed = 5 } = {}) {
  const R = rng(seed);
  const pos = [];
  const col = [];
  const size = [];
  const grp = [];
  const push = (x, y, z, c, s, gi) => {
    pos.push(x, y, z);
    col.push(...c);
    size.push(s);
    grp.push(gi);
  };
  const zDisk = (scale) => {
    // 지수 분포(얇은 원반)
    const u = R();
    return (R() < 0.5 ? -1 : 1) * -Math.log(Math.max(1e-6, u)) * scale;
  };
  // 원반: 지수 원반 표본 (반지름 분포 R e^{-R/h})
  for (let i = 0; i < disk; i++) {
    let r = -8.5 * Math.log(Math.max(1e-6, R() * R()));
    if (r > 56) r = 56 * R();
    const th = R() * Math.PI * 2;
    const x = r * Math.cos(th);
    const y = r * Math.sin(th);
    const flare = 1 + Math.max(0, r - 30) / 25;
    push(x, y, zDisk(DISK_SCALE_H * 0.85 * flare), starColor(R, r < 12 ? 'old' : 'mix'), 0.6 + R() * 0.9, GROUP.disk);
  }
  // 나선팔
  const paths = ARMS.map((a) => armPath(a, 0.5));
  const lens = paths.map((P) => P.reduce((s, p, i) => (i ? s + Math.hypot(p.x - P[i - 1].x, p.y - P[i - 1].y) : 0), 0));
  const weights = ARMS.map((a, i) => lens[i] * (a.major ? 1.35 : 1) * (a.local ? 0.6 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  ARMS.forEach((a, ai) => {
    const P = paths[ai];
    const n = Math.round((arm * weights[ai]) / wsum);
    for (let i = 0; i < n; i++) {
      const k = 1 + Math.floor(R() * (P.length - 1));
      const p = P[k - 1];
      const q = P[k];
      const f = R();
      const fade = armFade(a, q.t, q.R);
      if (R() > fade) continue;
      const cx = p.x + (q.x - p.x) * f;
      const cy = p.y + (q.y - p.y) * f;
      const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const off = R.gauss() * a.w * 0.6;
      const along = R.gauss() * 0.3;
      const x = cx - ((q.y - p.y) / L) * off + ((q.x - p.x) / L) * along;
      const y = cy + ((q.x - p.x) / L) * off + ((q.y - p.y) / L) * along;
      const young = R() < 0.6;
      push(x, y, zDisk(DISK_SCALE_H * 0.6), starColor(R, young ? 'young' : 'mix'), young ? 0.9 + R() * 1.4 : 0.6 + R(), GROUP.arm);
    }
  });
  // 팽대부(땅콩 모양에 가까운 상자형)
  {
    const [ux, uy] = polarToXY(1, BAR.beta);
    for (let i = 0; i < bulge; i++) {
      const r = Math.pow(R(), 1.8);
      const a = R.gauss() * BULGE.a * 0.42 * (0.5 + r);
      const b = R.gauss() * BULGE.b * 0.42 * (0.5 + r);
      const peanut = 1 + 0.35 * Math.min(1, Math.abs(a) / BULGE.a);
      const c = R.gauss() * BULGE.c * 0.42 * (0.5 + r) * peanut;
      push(a * ux - b * uy, a * uy + b * ux, c, starColor(R, 'old'), 0.8 + R() * 1.2, GROUP.bulge);
    }
    // 막대
    for (let i = 0; i < bar; i++) {
      const a = (R() * 2 - 1) * BAR.half * (0.4 + 0.6 * Math.sqrt(R()));
      const b = R.gauss() * BAR.width * 0.42;
      const c = R.gauss() * 1.0;
      push(a * ux - b * uy, a * uy + b * ux, c, starColor(R, 'old'), 0.7 + R(), GROUP.bar);
    }
  }
  // 헤일로: 밀도 ∝ r^-3 → ln r 이 고르게
  for (let i = 0; i < halo; i++) {
    const r = Math.exp(Math.log(7) + R() * (Math.log(HALO_R) - Math.log(7)));
    const u = R() * 2 - 1;
    const th = R() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    push(r * s * Math.cos(th), r * s * Math.sin(th), r * u * 0.85, starColor(R, 'old'), 0.5 + R() * 0.7, GROUP.halo);
  }
  // 구상 성단: 약 150개, 은하 중심 쪽으로 몰려 있으며 헤일로 전체에 퍼져 있음
  const gcs = [];
  for (let i = 0; i < globular; i++) {
    const r1 = 2.5;
    const r2 = 110;
    const r = Math.pow(Math.pow(r1, -0.5) + R() * (Math.pow(r2, -0.5) - Math.pow(r1, -0.5)), -2);
    const u = R() * 2 - 1;
    const th = R() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const p = [r * s * Math.cos(th), r * s * Math.sin(th), r * u];
    gcs.push(p);
    push(p[0], p[1], p[2], [1.0, 0.86, 0.55], 4.2 + R() * 1.5, GROUP.globular);
  }
  KNOWN_GLOBULARS.forEach((o) => push(o.xyz[0], o.xyz[1], o.xyz[2], [1, 0.88, 0.6], 6, GROUP.globular));
  return {
    position: new Float32Array(pos),
    color: new Float32Array(col),
    size: new Float32Array(size),
    group: new Float32Array(grp),
    globulars: gcs,
  };
}

// ───────────────────────── 실제 천체 위치 ─────────────────────────
/** 태양 기준 은하 좌표(l, b, 거리 광년) → 이 모형의 3D 좌표(kly) */
export function helioToModel(lDeg, bDeg, dLy) {
  const d = dLy / 1000;
  const l = lDeg * D2R;
  const b = bDeg * D2R;
  const xh = d * Math.cos(b) * Math.cos(l); // 은하 중심 쪽
  const yh = d * Math.cos(b) * Math.sin(l); // 은경 90° 쪽
  return [-yh, -R_SUN + xh, d * Math.sin(b)];
}

/** 모형 평면에서 태양 기준 은경(도) */
export function galLonFromSun(x, y) {
  return norm360(Math.atan2(-x, y + R_SUN) * R2D);
}

export const KNOWN_GLOBULARS = [
  { id: 'm13', name: 'M13 (헤르쿨레스자리 구상 성단)', l: 59.01, b: 40.91, d: 22200 },
  { id: 'omega', name: '오메가 센타우리', l: 309.1, b: 15.03, d: 17090 },
].map((o) => ({ ...o, xyz: helioToModel(o.l, o.b, o.d) }));

/** 태양 근처의 대표 천체 (은경 l, 은위 b, 거리[광년]) — 거리는 대표값 */
export const LOCAL_OBJECTS = [
  { id: 'hyades', name: '히아데스 성단', kind: 'open', l: 180.06, b: -22.34, d: 153 },
  { id: 'pleiades', name: '플레이아데스 성단', kind: 'open', l: 166.57, b: -23.52, d: 444 },
  { id: 'orion', name: '오리온 대성운', kind: 'emission', l: 209.01, b: -19.38, d: 1344 },
  { id: 'horsehead', name: '말머리 성운', kind: 'dark', l: 206.9, b: -16.6, d: 1375 },
  { id: 'betelgeuse', name: '베텔게우스', kind: 'star', l: 199.79, b: -8.96, d: 550 },
  { id: 'deneb', name: '데네브', kind: 'star', l: 84.28, b: 1.99, d: 2600 },
  { id: 'antares', name: '안타레스', kind: 'star', l: 351.95, b: 15.06, d: 550 },
  { id: 'lagoon', name: '석호 성운(M8)', kind: 'emission', l: 6.0, b: -1.2, d: 4100 },
  { id: 'eagle', name: '독수리 성운(M16)', kind: 'emission', l: 17.0, b: 0.8, d: 5700 },
  { id: 'double', name: '페르세우스 이중 성단', kind: 'open', l: 135.0, b: -3.6, d: 7500 },
  { id: 'crab', name: '게 성운(M1)', kind: 'emission', l: 184.56, b: -5.78, d: 6500 },
  { id: 'carina', name: '용골자리 성운', kind: 'emission', l: 287.6, b: -0.6, d: 7500 },
].map((o) => ({ ...o, xyz: helioToModel(o.l, o.b, o.d) }));

/** 가장 가까운 별들 */
export const NEAR_STARS = [
  { name: '프록시마 센타우리', l: 313.94, b: -1.93, d: 4.24 },
  { name: '알파 센타우리', l: 315.73, b: -0.68, d: 4.37 },
  { name: '바너드별', l: 31.01, b: 14.06, d: 5.96 },
  { name: '울프 359', l: 244.05, b: 56.12, d: 7.86 },
  { name: '시리우스', l: 227.23, b: -8.89, d: 8.6 },
  { name: '알타이르', l: 47.74, b: -8.91, d: 16.7 },
  { name: '베가', l: 67.45, b: 19.24, d: 25 },
];

/** 은경 → 그 방향의 대표 별자리 (은하수가 지나는 별자리) */
const LON_CONST = [
  [0, '궁수자리'], [18, '방패자리'], [30, '독수리자리'], [52, '여우자리'], [65, '백조자리'], [98, '세페우스자리'],
  [110, '카시오페이아자리'], [135, '페르세우스자리'], [160, '마차부자리'], [175, '황소자리·마차부자리 경계'], [186, '쌍둥이자리'],
  [200, '외뿔소자리'], [222, '큰개자리'], [240, '고물자리'], [262, '돛자리'], [280, '용골자리'],
  [298, '남십자자리'], [305, '센타우루스자리'], [318, '직각자자리'], [335, '전갈자리'], [352, '궁수자리'],
];
export function constellationAtLon(l) {
  const x = norm360(l);
  let name = LON_CONST[0][1];
  for (const [a, n] of LON_CONST) if (x >= a) name = n;
  return name;
}

/** 시선 방향(은경 l)을 따라가며 원반의 별 밀도 표본 */
export function lineOfSight(lDeg, maxDist = 80, step = 0.25) {
  const out = [];
  const dir = [-Math.sin(lDeg * D2R), Math.cos(lDeg * D2R)];
  let sum = 0;
  for (let s = 0; s <= maxDist; s += step) {
    const x = dir[0] * s;
    const y = -R_SUN + dir[1] * s;
    const n = surfaceDensity(x, y);
    sum += n * step;
    out.push({ s, n, x, y });
  }
  return { samples: out, total: sum };
}
