// 천문 좌표 계산 (교육용 정밀도: J2000 좌표 그대로 사용 → 세차 운동 무시, 각도 오차 약 0.5° 이내)
// 좌표계: 적도 좌표(적경 α·적위 δ, J2000), 은하 좌표(은경 l·은위 b), 지평 좌표(방위각 A: 북→동, 고도 h)

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const OBLIQUITY = 23.4393; // 지구 자전축 기울기(황도 경사각), 도

/** 관측 위치: 서울(북위 37.6°, 동경 127.0°) */
export const OBSERVER = { name: '서울', lat: 37.57, lon: 126.98 };

export const norm360 = (a) => ((a % 360) + 360) % 360;
export const norm180 = (a) => {
  const x = norm360(a);
  return x > 180 ? x - 360 : x;
};

/** 율리우스일 */
export const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;

/** 그리니치 평균 항성시(도) */
export function gmstDeg(date) {
  const d = julianDay(date) - 2451545.0;
  return norm360(280.46061837 + 360.98564736629 * d);
}

/** 지방 항성시(도) */
export const lstDeg = (date, lonDeg = OBSERVER.lon) => norm360(gmstDeg(date) + lonDeg);

/** 태양의 황경(도) — 저정밀 태양 위치식 */
export function sunEclipticLon(date) {
  const n = julianDay(date) - 2451545.0;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * D2R;
  return norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

/** 황도 좌표 → 적도 좌표 */
export function eclToEq(lamDeg, betaDeg = 0) {
  const e = OBLIQUITY * D2R;
  const l = lamDeg * D2R;
  const b = betaDeg * D2R;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(b) * Math.sin(l) * Math.cos(e) - Math.sin(b) * Math.sin(e);
  const z = Math.cos(b) * Math.sin(l) * Math.sin(e) + Math.sin(b) * Math.cos(e);
  return { ra: norm360(Math.atan2(y, x) * R2D), dec: Math.asin(z) * R2D };
}

/** 적도 좌표 → 황도 좌표 */
export function eqToEcl(raDeg, decDeg) {
  const e = OBLIQUITY * D2R;
  const [x, y, z] = unit(raDeg, decDeg);
  const ye = y * Math.cos(e) + z * Math.sin(e);
  const ze = -y * Math.sin(e) + z * Math.cos(e);
  return { lam: norm360(Math.atan2(ye, x) * R2D), beta: Math.asin(clamp(ze, -1, 1)) * R2D };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function unit(lonDeg, latDeg) {
  const lo = lonDeg * D2R;
  const la = latDeg * D2R;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** 적도 좌표 → 지평 좌표. 방위각은 북(0°)→동(90°)→남(180°)→서(270°) */
export function eqToHor(raDeg, decDeg, lst, latDeg = OBSERVER.lat) {
  const H = (lst - raDeg) * D2R;
  const d = decDeg * D2R;
  const p = latDeg * D2R;
  const sinAlt = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const y = -Math.cos(d) * Math.sin(H);
  const x = Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H);
  return { alt: alt * R2D, az: norm360(Math.atan2(y, x) * R2D) };
}

// J2000 적도 → 은하 좌표 회전 행렬 (Hipparcos 정의)
export const EQ2GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

export function eqToGal(raDeg, decDeg) {
  const v = unit(raDeg, decDeg);
  const g = EQ2GAL.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  return { l: norm360(Math.atan2(g[1], g[0]) * R2D), b: Math.asin(clamp(g[2], -1, 1)) * R2D };
}

export function galToEq(lDeg, bDeg) {
  const g = unit(lDeg, bDeg);
  const v = [0, 1, 2].map((i) => EQ2GAL[0][i] * g[0] + EQ2GAL[1][i] * g[1] + EQ2GAL[2][i] * g[2]);
  return { ra: norm360(Math.atan2(v[1], v[0]) * R2D), dec: Math.asin(clamp(v[2], -1, 1)) * R2D };
}

/** 한국 표준시(KST, UTC+9)로 날짜 만들기. hour는 24 이상이면 다음 날 */
export function kstDate(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

/** 태양의 고도(도) */
export function sunAltitude(date, lat = OBSERVER.lat, lon = OBSERVER.lon) {
  const lam = sunEclipticLon(date);
  const { ra, dec } = eclToEq(lam);
  return eqToHor(ra, dec, lstDeg(date, lon), lat).alt;
}

// 주요 방향
export const GALACTIC_CENTER = galToEq(0, 0); // 궁수자리 (적경 약 17h46m, 적위 약 -29°)
export const GALACTIC_ANTICENTER = galToEq(180, 0); // 황소자리·마차부자리 경계 (적경 약 5h46m, 적위 약 +29°)

/** 시각 표시: 24 → '자정', 26 → '새벽 2시' */
export function hourLabel(h) {
  const hh = ((Math.round(h * 60) / 60) % 24 + 24) % 24;
  const H = Math.floor(hh);
  const M = Math.round((hh - H) * 60);
  const mm = M ? ` ${M}분` : '';
  if (H === 0 && !M) return '자정';
  if (H === 12 && !M) return '정오';
  if (H < 6) return `새벽 ${H === 0 ? 12 : H}시${mm}`;
  if (H < 12) return `오전 ${H}시${mm}`;
  if (H < 18) return `오후 ${H === 12 ? 12 : H - 12}시${mm}`;
  return `오후 ${H - 12}시${mm}`;
}

/** 대기에 의한 별빛 감소(대기 질량) — 지평선 근처가 어두워지는 효과 */
export function airmass(altDeg) {
  if (altDeg <= 0) return 40;
  const h = altDeg;
  return 1 / (Math.sin((h + 244 / (165 + 47 * Math.pow(h, 1.1))) * D2R));
}
