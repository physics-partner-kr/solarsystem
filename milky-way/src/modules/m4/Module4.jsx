import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OrbitView, { nightConstellation } from './OrbitView.jsx';
import SkyView, { LIGHT, twilightLevel } from './SkyView.jsx';
import DirectionCompare, { DensityChart, PanoCrop } from './DirectionCompare.jsx';
import CelestialCylinder from './CelestialCylinder.jsx';
import SeasonPhotoQuiz, { SEASON_COLOR, SEASON_NAME, makeRounds, photoDate } from './SeasonPhotoQuiz.jsx';
import { Mission, ModuleShell, ScaleNote, Seg, SubTabs, T, fmt, useArrowSteps } from '../../components/ui.jsx';
import { CONFIG } from '../../config.js';
import { GALACTIC_CENTER, airmass, hourLabel, kstDate, sunEclipticLon } from '../../lib/astro.js';
import { constellationAtLon } from '../../lib/galaxy.js';
import { apply, skyState, vecToAltAz } from '../../lib/skyMath.js';
import { panoramaLuminance } from '../../lib/skyTexture.js';
import { useProgress } from '../../store.jsx';
import { unit } from '../../lib/astro.js';

const TABS = [
  { id: 'orbit', label: '① 공전' },
  { id: 'spin', label: '② 자전' },
  { id: 'dir', label: '③ 중심 vs 반대 방향' },
  { id: 'sky', label: '④ 여름·겨울 관측' },
  { id: 'quiz', label: '⑤ 어느 계절일까?' },
];
const IDS = TABS.map((t) => t.id);
const TIMES = [
  { h: 20, label: '오후 8시' },
  { h: 22, label: '오후 10시' },
  { h: 24, label: '자정' },
  { h: 26, label: '새벽 2시' },
];
const SEASON = {
  summer: { name: '여름', color: '#ff9d5c', ...CONFIG.summerDate },
  winter: { name: '겨울', color: '#7fd0ff', ...CONFIG.winterDate },
};
const dateOf = (season, hour) => {
  const S = SEASON[season];
  return kstDate(S.year, S.month, S.day, hour);
};
const SEASON_BTNS = [
  { id: 'spring', name: '봄', m: 4, d: 15, color: 'var(--c-spring)' },
  { id: 'summer', name: '여름', m: 7, d: 15, color: 'var(--c-summer)' },
  { id: 'autumn', name: '가을', m: 10, d: 15, color: 'var(--c-autumn)' },
  { id: 'winter', name: '겨울', m: 1, d: 15, color: 'var(--c-winter)' },
];
const doyToDate = (doy) => new Date(Date.UTC(2026, 0, 1 + Math.round(doy), 15)); // 자정(KST 0시) = 전날 15시 UTC
const dateToDoy = (m, d) => Math.round((Date.UTC(2026, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
const fmtDate = (date) => {
  const k = new Date(date.getTime() + 9 * 3600000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
};

/** 보이는 은하수: 사진 밝기(배경 뺌)를 지평선 위에서 더한 ‘총량’과 ‘가장 밝은 부분’ */
function visibleMilkyWay(lum, date, light, twilight) {
  if (!lum) return null;
  const s = skyState(date);
  const L = LIGHT[light];
  const twi = twilight ? twilightLevel(s.sunAlt) : 0;
  const vis = L.mw * Math.max(0, 1 - twi * 1.25);
  let sum = 0;
  let peak = 0;
  const { W, H } = lum;
  for (let j = 0; j < H; j++) {
    const b = 90 - (j + 0.5);
    if (Math.abs(b) > 40) continue;
    const cb = Math.cos((b * Math.PI) / 180);
    for (let i = 0; i < W; i++) {
      const l = 180 - (i + 0.5);
      const hv = apply(s.G2H, unit(l, b));
      if (hv[2] <= 0.01) continue;
      const alt = Math.asin(hv[2]) * 57.29578;
      const ext = Math.pow(10, -0.4 * 0.28 * (airmass(alt) - 1));
      const v = lum.lum[j * W + i] * ext;
      sum += v * cb;
      if (alt > 5 && Math.abs(b) < 30 && v > peak) peak = v;
    }
  }
  return { sum: sum * vis, peak: peak * vis };
}

function gcAltitude(date) {
  const s = skyState(date);
  const hv = apply(s.E2H, unit(GALACTIC_CENTER.ra, GALACTIC_CENTER.dec));
  return vecToAltAz(hv);
}

export default function Module4({ meta, onReset, goTo }) {
  const p = useProgress();
  const { mark } = p;
  const [tab, setTab] = useState('orbit');
  useArrowSteps(IDS, tab, setTab);

  // ① 공전
  const [doy, setDoy] = useState(dateToDoy(7, 15));
  const [cmp, setCmp] = useState(false);
  const [showSky, setShowSky] = useState(true);
  const [camNight, setCamNight] = useState(false);
  const orbitRef = useRef(null);
  const orbitDate = useMemo(() => doyToDate(doy), [doy]);

  // ② 자전
  const [spinSeason, setSpinSeason] = useState('summer');
  const [hour, setHour] = useState(20);
  const [spinPlay, setSpinPlay] = useState(false);
  const spinDate = useMemo(() => dateOf(spinSeason, hour), [spinSeason, hour]);
  useEffect(() => {
    if (!spinPlay) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setHour((h) => {
        const n = h + dt * 0.5; // 1초에 30분
        if (n >= 26) {
          setSpinPlay(false);
          return 26;
        }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinPlay]);

  // ③ 방향
  const [lon, setLon] = useState(0);
  const [dirView, setDirView] = useState('cyl'); // cyl = 천구 원통(3D), map = 은하 지도(2D)
  const [cylMode, setCylMode] = useState('diorama'); // diorama | earth
  const markCb = useCallback((k) => mark(k), [mark]);
  useEffect(() => {
    if (tab !== 'dir') return;
    if (Math.abs(((lon + 540) % 360) - 180) < 12) mark('m4.dir.gc');
    if (Math.abs(lon - 180) < 12) mark('m4.dir.ac');
  }, [lon, tab, mark]);

  // ⑤ 사진 퀴즈
  const [rounds, setRounds] = useState(() => makeRounds(3));
  const [qi, setQi] = useState(0);
  const [qAns, setQAns] = useState([null, null]);
  const [qStatus, setQStatus] = useState('idle'); // idle | wrong | right
  const [qWrong, setQWrong] = useState([]);
  const [qReveal, setQReveal] = useState(false);
  const [qScore, setQScore] = useState([]); // 각 문제를 첫 시도에 맞혔는지
  const [qTries, setQTries] = useState(0);
  const qRound = rounds[qi];
  const setQAnswer = (i, v) => {
    setQAns((a) => a.map((x, k) => (k === i ? v : x)));
    setQWrong((w) => w.filter((k) => k !== i));
  };
  const checkQuiz = () => {
    const wrong = qRound.photos.map((ph, i) => (qAns[i] === ph.season ? null : i)).filter((i) => i !== null);
    mark('m4.photo.check');
    if (!wrong.length) {
      setQStatus('right');
      setQReveal(true);
      setQScore((sc) => [...sc.slice(0, qi), qTries === 0]);
      mark('m4.photo.correct');
    } else {
      setQStatus('wrong');
      setQWrong(wrong);
      setQTries((t) => t + 1);
    }
  };
  const nextQuiz = () => {
    if (qi < rounds.length - 1) setQi(qi + 1);
    else {
      setRounds(makeRounds(3));
      setQi(0);
      setQScore([]);
    }
    setQAns([null, null]);
    setQStatus('idle');
    setQWrong([]);
    setQReveal(false);
    setQTries(0);
  };

  // ④ 관측
  const [obsHour, setObsHour] = useState(22);
  const [mode, setMode] = useState('dome');
  const [az0, setAz0] = useState(180);
  const [lines, setLines] = useState(true);
  const [names, setNames] = useState(true);
  const [galEq, setGalEq] = useState(true);
  const [light, setLight] = useState(0);
  const [twi, setTwi] = useState(true);
  const [layout, setLayout] = useState('both');
  const [lum, setLum] = useState(null);
  useEffect(() => {
    let alive = true;
    panoramaLuminance().then((l) => alive && setLum(l));
    return () => {
      alive = false;
    };
  }, []);
  const sumDate = useMemo(() => dateOf('summer', obsHour), [obsHour]);
  const winDate = useMemo(() => dateOf('winter', obsHour), [obsHour]);
  const mwS = useMemo(() => visibleMilkyWay(lum, sumDate, light, twi), [lum, sumDate, light, twi]);
  const mwW = useMemo(() => visibleMilkyWay(lum, winDate, light, twi), [lum, winDate, light, twi]);
  const mwRef = useMemo(() => visibleMilkyWay(lum, dateOf('summer', 24), 0, false), [lum]);
  useEffect(() => {
    if (tab === 'sky' && layout === 'both') mark('m4.sky.compare');
  }, [tab, layout, mark]);

  const nightC = nightConstellation(orbitDate);
  const seasonOf = (d) => {
    const m = new Date(d.getTime() + 9 * 3600000).getUTCMonth() + 1;
    return m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울';
  };
  const gcMid = gcAltitude(orbitDate);
  const antiLam = (sunEclipticLon(orbitDate) + 180) % 360;
  const angTo = (x) => Math.abs(((antiLam - x + 540) % 360) - 180);
  const dGC = angTo(266.8); // 은하 중심의 황경
  const nightRel =
    dGC < 50
      ? { text: '은하 중심 쪽', sub: `은하 중심과 약 ${fmt(dGC, 0)}° 차이`, color: 'var(--c-summer)' }
      : 180 - dGC < 50
        ? { text: '은하 중심 반대쪽', sub: `반대 방향과 약 ${fmt(180 - dGC, 0)}° 차이`, color: 'var(--c-winter)' }
        : { text: '그 사이 방향', sub: '은하수가 비스듬히 지나요', color: 'var(--ink)' };

  let stage;
  let panel;
  if (tab === 'orbit') {
    stage = (
      <>
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
        <OrbitView
          ref={orbitRef}
          date={orbitDate}
          showSky={showSky}
          ghosts={
            cmp
              ? [
                  { date: doyToDate(dateToDoy(7, 15)), color: '#ff9d5c', label: '여름 밤 → <b>은하 중심 쪽</b>' },
                  { date: doyToDate(dateToDoy(1, 15)), color: '#7fd0ff', label: '겨울 밤 → <b>반대쪽</b>' },
                ]
              : []
          }
        />
        <ScaleNote>태양·지구의 크기와 거리는 실제 비율과 달라요(지구를 아주 크게 그림). 배경 별과 은하수는 실제 사진이며 아주 멀리 있어요.</ScaleNote>
        <div className="dock">
          {SEASON_BTNS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn ${Math.abs(doy - dateToDoy(s.m, s.d)) < 3 ? 'on' : ''}`}
              onClick={() => {
                setDoy(dateToDoy(s.m, s.d));
                orbitRef.current?.view(camNight ? 'night' : 'behind', doyToDate(dateToDoy(s.m, s.d)));
                mark('m4.orbit.season');
                mark(`m4.orbit.${s.id}`);
              }}
            >
              <span style={{ width: '.7rem', height: '.7rem', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              {s.name}
            </button>
          ))}
          <span className="sep" />
          <button type="button" className={`btn ${cmp ? 'on' : ''}`} onClick={() => { setCmp(!cmp); mark('m4.orbit.cmp'); }}>
            여름·겨울 비교
          </button>
          <span className="sep" />
          <button type="button" className={`btn ${!camNight ? 'on' : ''}`} onClick={() => { setCamNight(false); orbitRef.current?.view('behind', orbitDate); }}>
            전체 보기
          </button>
          <button type="button" className={`btn ${camNight ? 'on' : ''}`} onClick={() => { setCamNight(true); orbitRef.current?.view('night', orbitDate); mark('m4.orbit.night'); }}>
            밤하늘 쪽 보기
          </button>
        </div>
      </>
    );
    panel = (
      <>
        <p>
          지구는 태양 둘레를 1년에 한 바퀴 <T k="공전">공전</T>해요. <b>밤</b>은 지구에서 태양 <b>반대쪽</b>을 향한 쪽이므로, 공전 위치에 따라 밤하늘이 바라보는 우주의 방향이 달라져요.
        </p>
        <div className="row">
          <label htmlFor="m4-doy">날짜</label>
          <input
            id="m4-doy"
            type="range"
            min="0"
            max="364"
            value={doy}
            onChange={(e) => {
              setDoy(Number(e.target.value));
              mark('m4.orbit.season');
            }}
          />
          <output>{fmtDate(orbitDate)}</output>
        </div>
        <div className="ticks">
          {['1월', '4월', '7월', '10월', '12월'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <dl className="facts">
          <div>
            <dt>계절(북반구)</dt>
            <dd>{seasonOf(orbitDate)}</dd>
          </div>
          <div>
            <dt>자정에 남쪽 하늘 방향(태양 반대쪽)</dt>
            <dd>{nightC}</dd>
          </div>
          <div>
            <dt>자정에 은하 중심의 고도</dt>
            <dd>
              {gcMid.alt > 0 ? `${fmt(gcMid.alt, 0)}°` : '지평선 아래'}
              <small>서울 기준, 최대 약 23°</small>
            </dd>
          </div>
          <div>
            <dt>밤하늘 방향과 은하</dt>
            <dd style={{ color: nightRel.color }}>
              {nightRel.text}
              <small>{nightRel.sub}</small>
            </dd>
          </div>
        </dl>
        <div className="card">
          <h3>자전축 기울기와 헷갈리지 마세요</h3>
          <p>
            <T k="자전축">자전축</T>은 약 23.5° 기울어진 채 공전하는 내내 <b>같은 방향(북극성 쪽)</b>을 가리켜요. 자전축 기울기는 <b>계절에 따라 기온이 달라지는 까닭</b>이고, 계절마다 <b>밤하늘에 보이는 별자리·은하수가 달라지는 까닭</b>은 지구의 <b>공전</b>이에요.
          </p>
          <p className="note">지구 공전 궤도는 거의 원이라, 계절에 따라 태양이나 은하 중심과의 거리가 달라지는 효과는 거의 없어요.</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={showSky} onChange={(e) => setShowSky(e.target.checked)} />
          배경에 실제 은하수 사진 보기
        </label>
        <Mission
          id="m4c"
          no="4-①"
          question="같은 자정이라도 여름철과 겨울철에 지구의 밤하늘은 우주의 어느 쪽을 향할까요?"
          requires={[
            { key: 'm4.orbit.summer', label: '‘여름’ 단추를 눌러 지구의 위치와 밤하늘 방향 보기' },
            { key: 'm4.orbit.winter', label: '‘겨울’ 단추를 눌러 비교하기' },
          ]}
          options={[
            { text: '여름 밤은 은하 중심 쪽(궁수자리), 겨울 밤은 은하 중심 반대쪽(황소·마차부자리)을 향한다.', correct: true },
            { text: '여름 밤은 은하 중심 반대쪽, 겨울 밤은 은하 중심 쪽을 향한다.', hint: '여름을 고른 뒤, 보라색 ‘밤하늘 방향’ 화살표가 주황색 ‘은하 중심 방향’ 선과 같은 쪽인지 확인해 보세요.' },
            { text: '계절과 상관없이 밤하늘은 늘 같은 방향을 향한다.', hint: '날짜 막대를 움직이며 보라색 화살표가 어떻게 돌아가는지 보세요. 지구가 공전하면 태양 반대쪽도 바뀌어요.' },
          ]}
          explain="지구가 공전하면서 태양 반대쪽(밤하늘 방향)이 1년에 한 바퀴 돌아요. 여름 밤에는 은하 중심(궁수자리) 쪽을, 겨울 밤에는 그 반대쪽을 바라봐요."
          next={{ label: '다음: ② 자전', onClick: () => setTab('spin') }}
        />
      </>
    );
  } else if (tab === 'spin') {
    const pos = gcAltitude(spinDate);
    stage = (
      <>
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
        <div className="fill spin-grid">
          <div style={{ position: 'relative', minHeight: 0 }}>
            <OrbitView date={spinDate} follow nightCone={false} seasonMarks={false} />
            <ScaleNote style={{ top: 'auto', bottom: '.8rem', left: '.8rem', right: 'auto', maxWidth: 'calc(100% - 1.6rem)' }}>
              지구를 크게 확대한 그림이에요. <b style={{ color: '#6fd39a' }}>초록 화살표</b> = 서울 관측자의 머리 위(천정) 방향, <b style={{ color: '#ffd66b' }}>노란 화살표</b> = 자전 방향.
            </ScaleNote>
          </div>
          <div style={{ position: 'relative', minHeight: 0, borderLeft: '1px solid var(--line)' }}>
            <SkyView
              date={spinDate}
              mode="pano"
              az0={180}
              compact
              lines
              names
              galEq
              light={0}
              twilight
              title={`${SEASON[spinSeason].name} ${SEASON[spinSeason].month}월 ${SEASON[spinSeason].day}일 ${hourLabel(hour)}`}
              sub="서울에서 남쪽 하늘을 바라본 모습"
              accent={SEASON[spinSeason].color}
            />
          </div>
        </div>
        <div className="dock">
          <button type="button" className={`btn ${spinPlay ? 'on' : 'primary'}`} onClick={() => { if (hour >= 26) setHour(20); setSpinPlay(!spinPlay); mark('m4.spin.time'); }}>
            {spinPlay ? '❚❚ 멈춤' : '▶ 시간 흐르기'}
          </button>
          {TIMES.map((t) => (
            <button key={t.h} type="button" className={`btn ${Math.abs(hour - t.h) < 0.05 ? 'on' : ''}`} onClick={() => { setSpinPlay(false); setHour(t.h); mark('m4.spin.time'); }}>
              {t.label}
            </button>
          ))}
        </div>
      </>
    );
    panel = (
      <>
        <p>
          지구는 하루에 한 바퀴 <T k="자전">자전</T>해요(서쪽 → 동쪽). 그래서 땅 위의 관측자에게는 하늘의 별과 은하수가 <b>동쪽에서 떠서 서쪽으로</b> 움직이는 것처럼 보여요.
        </p>
        <Seg
          label="계절"
          value={spinSeason}
          onChange={(v) => { setSpinSeason(v); mark('m4.spin.season'); }}
          options={[
            { value: 'summer', label: '여름 (7월 15일)', color: SEASON.summer.color },
            { value: 'winter', label: '겨울 (1월 15일)', color: SEASON.winter.color },
          ]}
        />
        <div className="row">
          <label htmlFor="m4-hour">시각</label>
          <input id="m4-hour" type="range" min="20" max="26" step="0.25" value={hour} onChange={(e) => { setSpinPlay(false); setHour(Number(e.target.value)); mark('m4.spin.time'); }} />
          <output>{hourLabel(hour)}</output>
        </div>
        <dl className="facts">
          <div>
            <dt>지구가 돈 각도(오후 8시부터)</dt>
            <dd>
              약 {fmt((hour - 20) * 15, 0)}°<small>1시간에 15°</small>
            </dd>
          </div>
          <div>
            <dt>은하 중심(궁수자리) 고도</dt>
            <dd>
              {pos.alt > 0 ? `${fmt(pos.alt, 0)}°` : '지평선 아래'}
              <small>{pos.alt > 0 ? `방위 ${fmt(pos.az, 0)}°(${pos.az < 180 ? '남동' : '남서'}쪽)` : '보이지 않아요'}</small>
            </dd>
          </div>
        </dl>
        <div className="card">
          <h3>핵심</h3>
          <p>
            지구의 <b>자전</b>은 하루 동안 관측자가 바라보는 우주의 방향과 천체의 겉보기 위치를 바꿔요. 하지만 몇 시간 사이에 보이는 하늘은 그 계절의 밤하늘 범위 안에서 움직일 뿐이에요.
          </p>
        </div>
        <p className="note">여름 오후 8시에는 해가 진 직후라 하늘이 아직 밝아요(박명). 실제 관측도 이 시간에는 은하수가 잘 보이지 않아요.</p>
        <Mission
          id="m4d"
          no="4-②"
          question="같은 날 밤, 시간이 지나면 남쪽 하늘의 은하수와 별들은 어느 쪽으로 움직여 보일까요?"
          requires={[{ key: 'm4.spin.time', label: '시각을 바꾸거나 ‘시간 흐르기’로 하늘 변화 보기' }]}
          options={[
            { text: '동쪽에서 서쪽으로 (왼쪽에서 오른쪽으로)', correct: true },
            { text: '서쪽에서 동쪽으로 (오른쪽에서 왼쪽으로)', hint: '남쪽을 바라보면 왼쪽이 동쪽, 오른쪽이 서쪽이에요. 시간을 흐르게 하고 궁수자리가 어느 쪽으로 가는지 보세요.' },
            { text: '움직이지 않는다', hint: '‘시간 흐르기’를 눌러 보세요. 지구가 자전하니까 하늘이 움직여 보여요.' },
          ]}
          explain="지구가 서쪽에서 동쪽으로 자전하므로, 별과 은하수는 동쪽에서 서쪽으로 움직여 보여요(1시간에 약 15°). 이것을 ‘겉보기 운동’이라고 해요."
          next={{ label: '다음: ③ 은하 중심 vs 반대 방향', onClick: () => setTab('dir') }}
        />
      </>
    );
  } else if (tab === 'dir') {
    stage = (
      <>
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
        {dirView === 'cyl' ? (
          <>
            <CelestialCylinder lon={lon} setLon={(v) => { setLon(v); mark('m4.dir.pick'); }} mode={cylMode} onDrag={() => mark('m4.cyl.drag')} />
            <ScaleNote>
              원통은 지구를 중심으로 한 천구의 띠(실제로는 아주 멀다고 생각해요)이고, 벽에는 그 방향의 실제 은하수 사진이 붙어 있어요. 앞쪽 벽은 뒤에서 비쳐 보여 좌우가 바뀌어 보여요.
            </ScaleNote>
          </>
        ) : (
          <>
            <DirectionCompare l={lon} setL={(v) => { setLon(v); mark('m4.dir.pick'); }} onMark={markCb} />
            <ScaleNote>은하 지도는 위에서 내려다본 모형이에요. 지도를 누르면 그 방향으로 시선이 바뀌어요.</ScaleNote>
          </>
        )}
        <div className="dock">
          <button type="button" className={`btn ${dirView === 'cyl' && cylMode === 'diorama' ? 'on' : ''}`} onClick={() => { setDirView('cyl'); setCylMode('diorama'); }}>
            천구 원통
          </button>
          <button type="button" className={`btn ${dirView === 'cyl' && cylMode === 'earth' ? 'on' : ''}`} onClick={() => { setDirView('cyl'); setCylMode('earth'); mark('m4.cyl.earth'); }}>
            지구에서 둘러보기
          </button>
          <button type="button" className={`btn ${dirView === 'map' ? 'on' : ''}`} onClick={() => setDirView('map')}>
            지도·밀도 그래프
          </button>
          <span className="sep" />
          <button type="button" className={`btn ${lon === 0 ? 'on' : ''}`} onClick={() => setLon(0)}>
            <span style={{ color: '#ffc46b' }}>●</span> 중심 쪽(여름)
          </button>
          <button type="button" className={`btn ${lon === 180 ? 'on' : ''}`} onClick={() => setLon(180)}>
            <span style={{ color: '#7fd0ff' }}>●</span> 반대쪽(겨울)
          </button>
        </div>
      </>
    );
    panel = (
      <>
        <p>
          태양계는 은하 원반 <b>안</b>에 있어요. 원반 방향을 보면 별빛이 겹겹이 겹쳐 <T k="은하수">은하수</T>로 보여요. 그런데 어느 쪽을 보느냐에 따라 시선이 지나가는 별의 양이 크게 달라요.
        </p>
        <div className="card">
          <h3>은하수 = 우리 은하를 안에서 본 모습</h3>
          <p>
            지구에서 보이는 별들이 아주 먼 둥근 면(<T k="천구">천구</T>)에 붙어 있다고 생각해 보세요. 화면의 원통은 천구 가운데 <b>은하수가 지나는 띠</b>만 잘라 세운 것이고, 벽에는 지구에서 그 방향을 본 <b>실제 은하수 사진</b>이 붙어 있어요.
          </p>
          <ul>
            <li>
              <b style={{ color: '#ffb3cf' }}>넓고 밝은 은하수</b> = 은하 중심의 <b>팽대부</b> 쪽을 바라본 모습(궁수자리, 여름철 밤)
            </li>
            <li>
              <b style={{ color: 'var(--c-winter)' }}>어둡고 가는 은하수</b> = 은하 중심에서 멀어지는, <b>별이 적은 바깥쪽</b>을 바라본 모습(마차부·황소자리, 겨울철 밤)
            </li>
          </ul>
          <p className="note">‘지구에서 둘러보기’를 누르면 태양계 자리에서 빙 둘러본 하늘이 돼요. 좌우로 끌어 보세요.</p>
        </div>
        <div className="row">
          <label htmlFor="m4-lon">시선 방향</label>
          <input id="m4-lon" type="range" min="0" max="359" value={lon} onChange={(e) => { setLon(Number(e.target.value)); mark('m4.dir.pick'); }} />
          <output>{constellationAtLon(lon)}</output>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', height: '8.5rem', margin: '.6rem 0' }}>
          <PanoCrop l0={0} label="은하 중심 쪽 (여름철)" color="#ffc46b" />
          <PanoCrop l0={180} label="반대쪽 (겨울철)" color="#7fd0ff" />
        </div>
        <div className="narrow-only card">
          <h3>시선을 따라가며 만나는 별의 밀도</h3>
          <DensityChart l={lon} />
        </div>
        <table className="cmp">
          <thead>
            <tr>
              <th />
              <th style={{ color: '#ffc46b' }}>은하 중심 쪽</th>
              <th style={{ color: '#7fd0ff' }}>반대쪽</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>잘 보이는 계절</td><td>여름철 밤</td><td>겨울철 밤</td></tr>
            <tr><td>별자리</td><td>궁수자리·전갈자리</td><td>황소·마차부·쌍둥이자리</td></tr>
            <tr><td>시선 끝까지</td><td>약 7만 6천 광년(중심을 지나 반대편까지)</td><td>약 2만 4천 광년(원반 가장자리까지)</td></tr>
            <tr><td>별·성간 물질</td><td>많고 빽빽함(팽대부 포함)</td><td>적고 듬성듬성함</td></tr>
            <tr><td>은하수 모습</td><td>밝고, 먼지 띠로 복잡함</td><td>희미하고 가늘어 보임</td></tr>
          </tbody>
        </table>
        <p className="note">
          그래프와 비율은 먼지가 빛을 가리는 효과를 뺀 단순 모형이에요. 실제로는 <T k="성간 물질">성간 물질</T>(먼지)이 은하 중심 쪽 빛을 많이 가려서 검은 틈(먼지 띠)이 보여요. 그래도 여름철 은하수가 훨씬 밝아요.
        </p>
        <div className="card">
          <h3>은하의 두께가 변하는 걸까?</h3>
          <p>
            아니에요! 은하의 실제 모양과 두께는 몇 달 사이에 변하지 않아요. 계절에 따라 <b>바라보는 방향</b>이 달라져서, 그 방향에 있는 별과 성간 물질의 양이 다르기 때문에 겉보기 밝기와 모습이 달라 보이는 거예요.
          </p>
        </div>
        <button type="button" className="btn primary next-link" onClick={() => setTab('sky')}>
          다음: ④ 여름·겨울 은하수 관측 →
        </button>
      </>
    );
  } else if (tab === 'quiz') {
    const peaks = qRound.photos.map((ph) => visibleMilkyWay(lum, photoDate(ph.season, qRound.hour), 0, false));
    const pmax = Math.max(...peaks.map((v) => v?.peak || 0)) || 1;
    stage = (
      <>
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
        <SeasonPhotoQuiz
          round={qRound}
          answers={qAns}
          setAnswer={setQAnswer}
          checked={qStatus === 'right'}
          wrong={qWrong}
          reveal={qReveal}
        />
        <div className="dock">
          <span className="btn" style={{ cursor: 'default', fontVariantNumeric: 'tabular-nums' }}>
            문제 {qi + 1}/{rounds.length}
          </span>
          {qStatus !== 'right' ? (
            <button type="button" className="btn primary" disabled={qAns.some((a) => !a)} onClick={checkQuiz}>
              {qAns.some((a) => !a) ? '두 사진의 계절을 모두 고르세요' : '확인하기'}
            </button>
          ) : (
            <>
              <button type="button" className={`btn ${qReveal ? 'on' : ''}`} onClick={() => setQReveal(!qReveal)}>
                은하 중심·별자리 표시
              </button>
              <button type="button" className="btn primary" onClick={nextQuiz}>
                {qi < rounds.length - 1 ? '다음 사진 →' : '새 사진으로 다시'}
              </button>
            </>
          )}
        </div>
      </>
    );
    panel = (
      <>
        <p style={{ fontSize: '1rem', color: 'var(--ink)' }}>
          <b>우리나라에서 찍은 두 사진은 각각 어느 계절의 은하수일까요?</b>
        </p>
        <p>
          하늘 전체를 한 장에 담은 <b>전천 사진</b>이에요. 원의 가운데가 머리 위(<T k="천정">천정</T>), 둘레가 <T k="지평선">지평선</T>이에요. 두 사진을 비교해 계절을 골라 보세요.
        </p>
        <div className="card">
          <h3>관찰 포인트</h3>
          <ul>
            <li>은하수 띠가 <b>넓고 밝은가</b>, 아니면 <b>가늘고 희미한가</b>?</li>
            <li>은하수가 <b>검은 틈(먼지 띠)</b>으로 갈라져 보이는가?</li>
            <li>은하수가 특히 <b>밝게 부풀어 오른 곳</b>이 있는가? 있다면 어디쯤인가?</li>
          </ul>
          <p className="note">사진마다 카메라 방향이 달라요. 사진 속 위치보다 은하수 자체의 모습을 비교하세요.</p>
        </div>
        {qStatus === 'wrong' && (
          <div className="feedback hint" role="status">
            <b>다시 생각해 보세요.</b> ×표가 붙은 사진을 다시 보세요. ③의 천구 원통을 떠올려 보세요: 여름철 밤에는 은하 중심(팽대부) 쪽을 보므로, 별과 성간 물질이 많아 은하수가 <b>넓고 밝으며 먼지 띠로 갈라져</b> 보여요. 밝은 별이 몇 개 있는 것과 은하수가 밝은 것은 달라요!
          </div>
        )}
        {qStatus === 'right' && (
          <div className="feedback good" role="status">
            <b>정답이에요!</b>
            {qRound.photos.map((ph, i) => (
              <span key={i} style={{ display: 'block', marginTop: '.3rem' }}>
                <b style={{ color: SEASON_COLOR[ph.season] }}>사진 {['가', '나'][i]} — {SEASON_NAME[ph.season]}철 은하수:</b>{' '}
                {ph.season === 'summer'
                  ? '은하 중심(궁수자리) 쪽을 본 모습. 넓고 밝으며 검은 먼지 띠로 갈라져 보이고, 가장 밝은 부분(팽대부 방향)이 남쪽 지평선 가까이에 있어요.'
                  : '은하 중심 반대쪽(마차부·황소자리 부근)을 본 모습. 별이 적은 은하 바깥쪽이라 희미하고 가늘게 보여요.'}
              </span>
            ))}
          </div>
        )}
        {qStatus === 'right' && lum && (
          <>
            <h2>사진으로 잰 은하수의 가장 밝은 부분</h2>
            <div className="bars">
              {qRound.photos.map((ph, i) => (
                <div className="bar" key={i}>
                  <span>사진 {['가', '나'][i]}</span>
                  <span className="track">
                    <span className="fillb" style={{ display: 'block', width: `${Math.max(2, ((peaks[i]?.peak || 0) / pmax) * 100)}%`, background: SEASON_COLOR[ph.season] }} />
                  </span>
                  <output>{fmt(((peaks[i]?.peak || 0) / pmax) * 100, 0)}</output>
                </div>
              ))}
            </div>
            <p className="note">은하의 두께가 계절마다 변하는 게 아니라, 바라보는 방향의 별과 성간 물질 양이 달라서 생기는 차이예요.</p>
          </>
        )}
        {qScore.length > 0 && (
          <p style={{ fontVariantNumeric: 'tabular-nums' }}>
            첫 시도에 맞힌 문제: <b>{qScore.filter(Boolean).length}</b> / {qScore.length}
          </p>
        )}
        <p className="note">
          사진은 ESO의 실제 은하수 사진과 실제 별 위치로, 서울에서 그 날짜·시각에 보이는 하늘을 전천 카메라처럼 만든 시뮬레이션이에요. 여름은 {CONFIG.summerDate.month}월 {CONFIG.summerDate.day}일, 겨울은 {CONFIG.winterDate.month}월 {CONFIG.winterDate.day}일 밤이에요.
        </p>
      </>
    );
  } else {
    const both = layout === 'both';
    const views = both ? ['summer', 'winter'] : [layout];
    stage = (
      <>
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
        <div className={`fill sky-grid ${both ? (mode === 'pano' ? 'stack' : 'both') : ''}`}>
          {views.map((sv) => {
            const d = sv === 'summer' ? sumDate : winDate;
            return (
              <div key={sv} style={{ position: 'relative', minHeight: 0 }}>
                <SkyView
                  date={d}
                  mode={mode}
                  az0={az0}
                  onAz0={(v) => { setAz0(v); mark('m4.sky.view'); }}
                  lines={lines}
                  names={names}
                  galEq={galEq}
                  light={light}
                  twilight={twi}
                  compact={both}
                  title={`${SEASON[sv].name} · ${SEASON[sv].month}월 ${SEASON[sv].day}일 ${hourLabel(obsHour)}`}
                  sub={`서울(북위 37.6°) · ${LIGHT[light].name}`}
                  accent={SEASON[sv].color}
                />
              </div>
            );
          })}
        </div>
        <div className="dock">
          {TIMES.map((t) => (
            <button key={t.h} type="button" className={`btn ${obsHour === t.h ? 'on' : ''}`} onClick={() => { setObsHour(t.h); mark('m4.sky.time'); }}>
              {t.label}
            </button>
          ))}
          <span className="sep" />
          <button type="button" className={`btn ${mode === 'dome' ? 'on' : ''}`} onClick={() => { setMode('dome'); mark('m4.sky.view'); }}>
            하늘 전체
          </button>
          <button type="button" className={`btn ${mode === 'pano' ? 'on' : ''}`} onClick={() => { setMode('pano'); mark('m4.sky.view'); }}>
            지평선 보기
          </button>
        </div>
      </>
    );
    const gS = gcAltitude(sumDate);
    const gW = gcAltitude(winDate);
    panel = (
      <>
        <p>
          북반구(서울)에서 같은 시각에 여름과 겨울의 밤하늘을 나란히 비교해 보세요. 점선은 <b>은하 적도</b>(은하수의 한가운데 선)예요.
        </p>
        <Seg
          label="화면 구성"
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'both', label: '나란히 비교' },
            { value: 'summer', label: '여름만', color: SEASON.summer.color },
            { value: 'winter', label: '겨울만', color: SEASON.winter.color },
          ]}
        />
        <h2>사진으로 잰 은하수 밝기 (상대값)</h2>
        {[
          ['가장 밝은 부분', 'peak'],
          ['보이는 빛의 총량', 'sum'],
        ].map(([title, key]) => (
          <div key={key}>
            <h3 style={{ margin: '.5rem 0 .1rem', fontSize: '.88rem' }}>{title}</h3>
            <div className="bars">
              {[
                ['여름', mwS, SEASON.summer.color],
                ['겨울', mwW, SEASON.winter.color],
              ].map(([n, v, c]) => {
                const pct = v && mwRef ? (v[key] / mwRef[key]) * 100 : null;
                return (
                  <div className="bar" key={n}>
                    <span>{n}</span>
                    <span className="track">
                      <span className="fillb" style={{ display: 'block', width: `${pct == null ? 0 : Math.min(100, Math.max(1, pct))}%`, background: c }} />
                    </span>
                    <output>{pct == null ? '…' : fmt(pct, 0)}</output>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="note">
          실제 은하수 사진(ESO)의 밝기를 지평선 위 하늘에서 재었어요. 100 = 여름 자정의 어두운 하늘. 지평선 근처 대기 감광·박명·광공해를 반영했어요. 여름의 은하 중심부는 남쪽 하늘에 낮게 떠서 대기에 많이 가려지는데도 가장 밝아요.
        </p>
        {twi && obsHour === 20 && (
          <p className="feedback hint" style={{ fontSize: '.85rem' }}>
            여름 오후 8시는 해가 진 직후라 하늘이 아직 밝아(박명) 은하수가 거의 보이지 않아요. 겨울은 해가 일찍 져서 이미 어두워요. 오후 10시 이후와 비교해 보세요.
          </p>
        )}
        <dl className="facts">
          <div>
            <dt>여름: 은하 중심 고도</dt>
            <dd>{gS.alt > 0 ? `${fmt(gS.alt, 0)}° (남쪽 하늘 낮게)` : '지평선 아래'}</dd>
          </div>
          <div>
            <dt>겨울: 은하 중심 고도</dt>
            <dd>{gW.alt > 0 ? `${fmt(gW.alt, 0)}°` : '지평선 아래(안 보임)'}</dd>
          </div>
        </dl>
        <h2>하늘 조건</h2>
        <Seg label="광공해" value={light} onChange={(v) => { setLight(v); mark('m4.sky.light'); }} options={LIGHT.map((l) => ({ value: l.id, label: l.name.replace('(어두운 하늘)', '') }))} />
        <label className="check">
          <input type="checkbox" checked={twi} onChange={(e) => setTwi(e.target.checked)} />
          <T k="박명">박명</T>(해 진 뒤 밝은 하늘) 반영
        </label>
        <label className="check">
          <input type="checkbox" checked={lines} onChange={(e) => setLines(e.target.checked)} />
          별자리 선
        </label>
        <label className="check">
          <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} />
          별·별자리 이름, 계절의 대삼각형
        </label>
        <label className="check">
          <input type="checkbox" checked={galEq} onChange={(e) => setGalEq(e.target.checked)} />
          은하 적도(점선)와 은하 중심 표시
        </label>
        <div className="card">
          <h3>정리</h3>
          <ul>
            <li>
              <b>여름</b>: 은하 중심(궁수자리) 쪽을 봐요 → 별과 성간 물질이 많아 <b>밝고 복잡한</b> 은하수. 남쪽 하늘에 낮게 떠요.
            </li>
            <li>
              <b>겨울</b>: 은하 중심 반대쪽(마차부자리 부근)을 봐요 → 별이 적어 <b>희미한</b> 은하수. 머리 위를 지나요.
            </li>
            <li>겨울철 밤하늘에는 시리우스·오리온자리처럼 밝은 별이 많지만, 이 별들은 대부분 태양 가까이에 있는 별이에요. 은하수의 뿌연 빛(아주 먼 수많은 별빛)은 여름이 훨씬 밝아요.</li>
            <li>은하수는 관측 시간, 장소, 계절, 지평선 높이, 광공해에 따라 다르게 보여요. 도시에서는 거의 보이지 않아요!</li>
          </ul>
        </div>
        <Mission
          id="m4a"
          no="4"
          question="북반구에서 여름철 은하수가 겨울철보다 밝고 두드러지게 관측되는 주된 이유는 무엇일까요?"
          requires={[
            { key: 'm4.dir.gc', label: '③에서 은하 중심 쪽 시선 보기' },
            { key: 'm4.dir.ac', label: '③에서 은하 중심 반대쪽 시선 보기' },
            { key: 'm4.sky.compare', label: '④에서 여름·겨울 하늘을 나란히 비교하기' },
            { key: 'm4.sky.time', label: '④에서 관측 시각 바꿔 보기' },
          ]}
          options={[
            { text: '여름에는 우리 은하의 원반이 더 두꺼워지기 때문이다.', hint: '은하의 실제 두께는 몇 달 사이에 변하지 않아요. 계절에 따라 바뀌는 것은 무엇이었나요? ③을 다시 보세요.' },
            { text: '여름철 밤에는 은하 중심 방향을 보게 되어, 시선 방향에 별과 성간 물질이 훨씬 많기 때문이다.', correct: true },
            { text: '여름에는 지구가 은하 중심에 더 가까워지기 때문이다.', hint: '지구 공전 궤도의 지름(약 3억 km)은 은하 중심까지 거리(2만 6천 광년)에 비하면 1억 분의 1도 안 돼요. 거리 차이는 거의 없어요.' },
            { text: '여름에는 태양이 더 밝게 빛나기 때문이다.', hint: '은하수는 밤에 태양 반대쪽 하늘에서 봐요. 태양빛이 밝으면 오히려 별이 안 보여요.' },
          ]}
          explain="여름철 밤하늘은 은하 중심(궁수자리) 방향을 향해요. 이 방향에는 은하 중심부의 팽대부와 여러 나선팔이 겹쳐 있어 별과 성간 물질이 매우 많아요. 겨울에는 별이 적은 원반 바깥쪽을 보게 돼요. 은하의 모양이 변하는 것이 아니라 보는 방향이 바뀌는 거예요."
        />
        <Mission
          id="m4b"
          no="5"
          question="지구의 자전과 공전 중, 계절에 따라 관측할 수 있는 은하 영역이 달라지는 원인과 관련된 운동은 무엇일까요?"
          requires={[
            { key: 'm4.orbit.season', label: '①에서 계절(날짜)을 바꿔 공전 위치 보기' },
            { key: 'm4.spin.time', label: '②에서 시각을 바꿔 자전 효과 보기' },
          ]}
          options={[
            { text: '지구의 자전', hint: '자전은 하루 동안 하늘을 동→서로 돌게 할 뿐, 몇 달에 걸친 변화는 만들지 않아요. ①에서 날짜를 바꿨을 때 무엇이 달라졌나요?' },
            { text: '지구의 공전', correct: true },
            { text: '달의 공전', hint: '달은 밤하늘을 밝혀 은하수를 가릴 수는 있지만, 계절마다 보이는 은하 영역을 바꾸지는 않아요.' },
          ]}
          explain="지구가 태양 둘레를 공전하면서 밤하늘이 향하는 우주의 방향이 1년에 걸쳐 바뀌어요. 그래서 여름에는 은하 중심 쪽, 겨울에는 반대쪽 은하수를 보게 돼요. 자전은 하루 동안의 겉보기 운동을 만들어요."
          next={{ label: '처음 화면으로', onClick: () => goTo('home') }}
        />
      </>
    );
  }

  return (
    <ModuleShell
      no={meta.no}
      title={meta.title}
      goal="북반구에서 여름철과 겨울철에 관측되는 은하수의 모습이 다른 이유를 지구의 자전·공전, 은하 중심 방향과 연결해 설명한다."
      onReset={onReset}
      stage={stage}
      panel={panel}
    />
  );
}

