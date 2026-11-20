import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GalaxyMap, { label } from '../../components/GalaxyMap.jsx';
import { useCanvasSize } from '../../components/ui.jsx';
import { D2R } from '../../lib/astro.js';
import { R_SUN, constellationAtLon, galLonFromSun, lineOfSight } from '../../lib/galaxy.js';
import { loadPanorama } from '../../lib/skyTexture.js';

const VIEW = { cx: 0, cy: -8, w: 128 };

/** 시선 방향(은경 l)의 단위 벡터(모형 평면) */
export const dirOf = (l) => [-Math.sin(l * D2R), Math.cos(l * D2R)];

/** 은하 좌표 파노라마 사진에서 한 방향을 잘라 보여 줌 */
export function PanoCrop({ l0, b0 = 0, lSpan = 100, bSpan = 56, label: lab, color }) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const size = useCanvasSize(wrap);
  const [img, setImg] = useState(null);
  useEffect(() => {
    let alive = true;
    loadPanorama().then((r) => alive && setImg(r));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const c = cv.current;
    const { w, h, dpr } = size;
    if (!w || !img) return;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    const im = img.image;
    const W = im.width;
    const H = im.height;
    const sw = (lSpan / 360) * W;
    const sh = (bSpan / 180) * H;
    let sx = (0.5 - l0 / 360) * W - sw / 2;
    sx = ((sx % W) + W) % W;
    const sy = Math.max(0, Math.min(H - sh, H / 2 - (b0 / 180) * H - sh / 2));
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    // 이음매를 넘으면 두 번에 나눠 그림
    const first = Math.min(sw, W - sx);
    g.drawImage(im, sx, sy, first, sh, 0, 0, (first / sw) * c.width, c.height);
    if (first < sw) g.drawImage(im, 0, sy, sw - first, sh, (first / sw) * c.width, 0, ((sw - first) / sw) * c.width, c.height);
  }, [size, img, l0, b0, lSpan, bSpan]);
  return (
    <figure className="photo" style={{ margin: 0, height: '100%' }} ref={wrap}>
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} aria-label={lab} />
      {lab && (
        <span className="tag" style={{ color }}>
          {lab}
        </span>
      )}
      <figcaption>{img?.photo ? '사진: ESO/S. Brunier (CC BY 4.0) — 같은 사진에서 같은 크기로 잘라 비교' : '사진을 불러오지 못해 모형 그림으로 대신 보여 줌'}</figcaption>
    </figure>
  );
}

/** 시선 방향의 별 밀도 그래프 */
export function DensityChart({ l, compare = [0, 180] }) {
  const series = useMemo(() => {
    const ls = [...new Set([...compare, Math.round(l)])];
    return ls.map((x) => ({ l: x, ...lineOfSight(x, 80, 0.5) }));
  }, [l, compare]);
  const maxN = 2.2;
  const W = 340;
  const H = 150;
  const colorOf = (x) => (x === 0 ? '#ffc46b' : x === 180 ? '#7fd0ff' : '#c9a2ff');
  return (
    <svg viewBox={`0 0 ${W} ${H + 34}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="시선 방향으로 가면서 만나는 별의 밀도 그래프">
      <line x1="34" y1={H} x2={W - 6} y2={H} stroke="rgba(170,195,255,.4)" />
      <line x1="34" y1="6" x2="34" y2={H} stroke="rgba(170,195,255,.4)" />
      {[0, 20, 40, 60, 80].map((d) => (
        <text key={d} x={34 + (d / 80) * (W - 40)} y={H + 15} fill="#aebbd8" fontSize="11" textAnchor="middle">
          {d === 0 ? '태양' : `${d / 10}만`}
        </text>
      ))}
      <text x={W - 6} y={H + 30} fill="#aebbd8" fontSize="11" textAnchor="end">
        태양에서의 거리(광년)
      </text>
      <text x="6" y="12" fill="#aebbd8" fontSize="11">
        별의 밀도
      </text>
      {series.map((s) => {
        const d = s.samples.map((p, i) => `${i ? 'L' : 'M'}${(34 + (p.s / 80) * (W - 40)).toFixed(1)} ${(H - Math.min(1, p.n / maxN) * (H - 14)).toFixed(1)}`).join(' ');
        return <path key={s.l} d={d} fill="none" stroke={colorOf(s.l)} strokeWidth={s.l === Math.round(l) && !compare.includes(s.l) ? 2.5 : 2} opacity={0.95} />;
      })}
    </svg>
  );
}

export default function DirectionCompare({ l, setL, onMark }) {
  const [view, setView] = useState(VIEW);
  const map = useRef(null);
  const totals = useMemo(() => ({ gc: lineOfSight(0).total, ac: lineOfSight(180).total }), []);

  const pick = useCallback(
    (x, y) => {
      const ll = galLonFromSun(x, y);
      setL(Math.round(ll));
    },
    [setL],
  );
  useEffect(() => {
    if (Math.abs(((l + 540) % 360) - 180) < 12) onMark?.('m4.dir.gc');
    if (Math.abs(l - 180) < 12) onMark?.('m4.dir.ac');
  }, [l, onMark]);

  const draw = useCallback(
    (g, { P, k }) => {
      const [SX, SY] = P(0, -R_SUN);
      const wedge = (l0, color, txt, sub) => {
        const half = 22;
        const len = 90;
        g.fillStyle = color + '22';
        g.strokeStyle = color + 'aa';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(SX, SY);
        for (let a = -half; a <= half; a += 2) {
          const [dx, dy] = dirOf(l0 + a);
          g.lineTo(SX + dx * len * k, SY - dy * len * k);
        }
        g.closePath();
        g.fill();
        g.stroke();
        const [dx, dy] = dirOf(l0);
        const tx = SX + dx * Math.min(34, 60) * k;
        const ty = SY - dy * Math.min(34, 60) * k;
        label(g, txt, tx, ty - 10, color, 15, 'center', 750);
        label(g, sub, tx, ty + 10, '#e8eeff', 12.5, 'center', 600);
      };
      wedge(0, '#ffc46b', '여름철 밤에 보는 방향', '은하 중심 쪽 (궁수자리)');
      wedge(180, '#7fd0ff', '겨울철 밤에 보는 방향', '은하 중심 반대쪽 (황소·마차부자리)');
      // 지금 고른 시선
      const [dx, dy] = dirOf(l);
      g.strokeStyle = '#c9a2ff';
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(SX, SY);
      g.lineTo(SX + dx * 80 * k, SY - dy * 80 * k);
      g.stroke();
      g.setLineDash([]);
      const hx = SX + dx * 9 * k;
      const hy = SY - dy * 9 * k;
      g.fillStyle = '#c9a2ff';
      g.beginPath();
      g.arc(hx, hy, 7, 0, Math.PI * 2);
      g.fill();
      label(g, `시선: ${constellationAtLon(l)}`, hx + 12, hy, '#e6d6ff', 13.5, 'left', 700);
      // 태양
      g.fillStyle = '#ffe14d';
      g.shadowColor = '#ffe14d';
      g.shadowBlur = 12;
      g.beginPath();
      g.arc(SX, SY, 5, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      label(g, '태양계', SX - 12, SY + 4, '#ffe14d', 14, 'right', 750);
      const [GX, GY] = P(0, 0);
      label(g, '은하 중심', GX, GY - 18, '#ffc46b', 13);
    },
    [l],
  );

  return (
    <>
      <GalaxyMap ref={map} view={view} setView={setView} draw={draw} onPick={pick} interactive />
      <div className="dir-chart" style={{ position: 'absolute', left: '.9rem', bottom: 'calc(var(--dock-h, 0px) + 5.2rem)', zIndex: 5, width: 'min(46%, 25rem)', padding: '.55rem .7rem', borderRadius: '.8rem', background: 'rgba(6,12,30,.85)', border: '1px solid var(--line)' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, marginBottom: '.2rem' }}>시선을 따라가며 만나는 별의 밀도</div>
        <DensityChart l={l} />
        <div style={{ fontSize: '.78rem', color: 'var(--ink-3)' }}>
          <span style={{ color: '#ffc46b' }}>━ 은하 중심 쪽</span> · <span style={{ color: '#7fd0ff' }}>━ 반대쪽</span> · <span style={{ color: '#c9a2ff' }}>━ 고른 방향</span> · 시선 방향 별빛 합계 비(모형): 약{' '}
          {Math.round(totals.gc / totals.ac)} : 1
        </div>
      </div>
    </>
  );
}
