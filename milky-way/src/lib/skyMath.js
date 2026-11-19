import { D2R, R2D, EQ2GAL, OBSERVER, lstDeg, sunEclipticLon, eclToEq, unit, norm360 } from './astro.js';

/** 지평 좌표(북 N, 동 E, 위 U) → 적도 좌표 회전 행렬(행 우선 3×3) */
export function horToEq(lst, lat = OBSERVER.lat) {
  const t = lst * D2R;
  const p = lat * D2R;
  const N = [-Math.sin(p) * Math.cos(t), -Math.sin(p) * Math.sin(t), Math.cos(p)];
  const E = [-Math.sin(t), Math.cos(t), 0];
  const U = [Math.cos(p) * Math.cos(t), Math.cos(p) * Math.sin(t), Math.sin(p)];
  // 열 = N, E, U
  return [
    [N[0], E[0], U[0]],
    [N[1], E[1], U[1]],
    [N[2], E[2], U[2]],
  ];
}
export const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export const tr = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
export const apply = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];

/** 날짜(UTC Date)에 대한 하늘 상태 */
export function skyState(date, lat = OBSERVER.lat, lon = OBSERVER.lon) {
  const lst = lstDeg(date, lon);
  const H2E = horToEq(lst, lat);
  const E2H = tr(H2E);
  const H2G = mul(EQ2GAL, H2E);
  const sunLam = sunEclipticLon(date);
  const s = eclToEq(sunLam);
  const sunHor = apply(E2H, unit(s.ra, s.dec));
  return { lst, H2E, E2H, H2G, G2H: tr(H2G), sunHor, sunAlt: Math.asin(sunHor[2]) * R2D, sunLam };
}

/** 지평 벡터 → 고도·방위각 */
export function vecToAltAz(v) {
  return { alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D, az: norm360(Math.atan2(v[1], v[0]) * R2D) };
}

/**
 * 투영: 'dome' = 머리 위를 올려다본 전천(가운데 천정, 위 북쪽, 왼쪽 동쪽)
 *       'pano' = 지평선을 따라 펼친 파노라마(가운데 방위 az0)
 */
export function makeProjector(mode, w, h, az0 = 180) {
  if (mode === 'dome') {
    const R = Math.max(40, Math.min(w / 2 - 30, h / 2 - 26));
    const cx = w / 2;
    const cy = h / 2 + 6;
    return {
      mode, R, cx, cy,
      fwd(alt, az) {
        if (alt < -1) return null;
        const r = ((90 - alt) / 90) * R;
        return [cx - r * Math.sin(az * D2R), cy - r * Math.cos(az * D2R)];
      },
    };
  }
  const altMin = -8;
  const altMax = 82;
  const fovH = Math.min(300, ((altMax - altMin) * w) / h);
  return {
    mode, altMin, altMax, fovH, az0,
    fwd(alt, az) {
      let d = az - az0;
      d = ((d + 540) % 360) - 180;
      if (Math.abs(d) > fovH / 2 + 5) return null;
      return [w / 2 + (d / fovH) * w, h - ((alt - altMin) / (altMax - altMin)) * h];
    },
  };
}

/** B-V 색지수 → 별 색 */
export function bvColor(bv) {
  const t = Math.max(-0.4, Math.min(2, bv));
  if (t < 0) return [170, 195, 255];
  if (t < 0.3) return [215, 225, 255];
  if (t < 0.6) return [255, 248, 235];
  if (t < 1.0) return [255, 225, 175];
  if (t < 1.4) return [255, 200, 140];
  return [255, 170, 110];
}

export const BRIGHT_NAMES = [
  ['베가(직녀성)', 279.23, 38.78], ['알타이르(견우성)', 297.7, 8.87], ['데네브', 310.36, 45.28], ['안타레스', 247.35, -26.43],
  ['시리우스', 101.29, -16.72], ['베텔게우스', 88.79, 7.41], ['리겔', 78.63, -8.2], ['프로키온', 114.83, 5.22],
  ['카펠라', 79.17, 46.0], ['알데바란', 68.98, 16.51], ['북극성', 37.95, 89.26], ['폴룩스', 116.33, 28.03],
  ['아크투르스', 213.92, 19.18], ['스피카', 201.3, -11.16], ['포말하우트', 344.41, -29.62], ['레굴루스', 152.09, 11.97],
];
export const TRIANGLES = [
  { name: '여름철 대삼각형', color: '#ffb37a', stars: [[279.23, 38.78], [310.36, 45.28], [297.7, 8.87]] },
  { name: '겨울철 대삼각형', color: '#8fd0ff', stars: [[88.79, 7.41], [101.29, -16.72], [114.83, 5.22]] },
];
export const NAME_FIX = { Cyg: '백조자리', Her: '헤르쿨레스자리' };
