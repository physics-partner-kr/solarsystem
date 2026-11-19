import { useCallback, useEffect, useRef, useState } from 'react';
import GalaxyMap, { label } from '../../components/GalaxyMap.jsx';
import { Mission, ModuleShell, ScaleNote, T, fmt } from '../../components/ui.jsx';
import { ARMS, LOCAL_OBJECTS, R_SUN, armRadius, polarToXY } from '../../lib/galaxy.js';
import { useProgress } from '../../store.jsx';

const FULL = { cx: 0, cy: 0, w: 118 };
const NEAR = { cx: 0, cy: -R_SUN + 0.5, w: 17 };
const CLOSE = { cx: 0.2, cy: -R_SUN + 0.3, w: 5.2 };
const YEARS_PER_ORBIT = 2.3e8; // 약 2억 3천만 년 (2억 2천만~2억 5천만 년)

const STEPS = [
  { n: 1, t: '태양계 찾기', d: '은하 전체 그림에서 태양계가 있을 것 같은 곳을 눌러 예측한 뒤, 정답을 확인해요.' },
  { n: 2, t: '태양계 확대', d: '태양계가 있는 곳으로 확대해요.' },
  { n: 3, t: '주변 나선팔 확인', d: '태양계 주변의 나선팔과 천체를 살펴봐요.' },
  { n: 4, t: '은하 전체로 축소', d: '다시 은하 전체를 보며 태양계의 위치를 정리해요.' },
];

// 태양 근처에서 각 나선팔까지의 거리(태양-은하 중심 방향 직선 위)
const armAtSun = (id) => armRadius(ARMS.find((a) => a.id === id), 0);

export default function Module3({ meta, onReset, goTo }) {
  const p = useProgress();
  const { mark } = p;
  const map = useRef(null);
  const [view, setView] = useState(FULL);
  const [step, setStep] = useState(1);
  const [guess, setGuess] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [years, setYears] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showObj, setShowObj] = useState(true);
  const raf = useRef(0);

  const pick = useCallback(
    (x, y) => {
      if (step === 1 && !revealed) {
        setGuess([x, y]);
        mark('m3.guess');
      } else if (Math.hypot(x, y + R_SUN) < Math.max(0.8, view.w * 0.03)) {
        setRevealed(true);
        mark('m3.select');
      }
    },
    [step, revealed, view.w, mark],
  );

  const reveal = () => {
    setRevealed(true);
    mark('m3.select');
  };
  const zoomIn = async () => {
    setRevealed(true);
    mark('m3.select');
    setStep(2);
    await map.current?.flyTo(NEAR, 1800);
    mark('m3.zoomin');
  };
  const arms = async () => {
    setStep(3);
    await map.current?.flyTo(CLOSE, 1300);
    mark('m3.arms');
  };
  const zoomOut = async () => {
    setStep(4);
    await map.current?.flyTo(FULL, 1800);
    mark('m3.zoomout');
  };
  useEffect(() => {
    if (view.w < 25) mark('m3.zoomin');
    if (view.w > 90 && (p.actions.has('m3.zoomin') || step >= 2)) mark('m3.zoomout');
  }, [view.w, mark, step, p.actions]);

  // 은하 공전 애니메이션
  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setYears((y) => {
        const n = y + dt * (YEARS_PER_ORBIT / 24); // 24초에 한 바퀴
        if (n >= YEARS_PER_ORBIT) {
          setPlaying(false);
          return YEARS_PER_ORBIT;
        }
        return n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const sunAngle = (years / YEARS_PER_ORBIT) * 360; // 위에서 보면 시계 방향
  const sunPos = polarToXY(R_SUN, sunAngle);

  const draw = useCallback(
    (g, { P, k, w, h, view: v }) => {
      const showSun = revealed || step > 1;
      // 은하 중심
      const [GX, GY] = P(0, 0);
      g.strokeStyle = '#ffc46b';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(GX - 9, GY);
      g.lineTo(GX + 9, GY);
      g.moveTo(GX, GY - 9);
      g.lineTo(GX, GY + 9);
      g.stroke();
      if (v.w > 30) label(g, '은하 중심', GX, GY - 20, '#ffc46b', 14);
      // 나선팔 이름
      if (v.w > 30) {
        ARMS.forEach((a) =>
          a.labels.forEach((l) => {
            const [x, y] = polarToXY(armRadius(a, l.beta), l.beta);
            const [X, Y] = P(x, y);
            label(g, l.text, X, Y, a.local ? '#ffe9a8' : '#a9d6ff', 13, 'center', 600);
          }),
        );
      } else {
        // 확대했을 때: 태양 근처 나선팔 이름과 거리
        const near = [
          { id: 'perseus', txt: '페르세우스자리 팔', sub: `태양계에서 바깥쪽으로 약 ${fmt(armAtSun('perseus') - R_SUN, 0)}천 광년` },
          { id: 'local', txt: '오리온자리 팔(국부 팔)', sub: '태양계가 있는 곳' },
          { id: 'sagittarius', txt: '궁수자리 팔', sub: `태양계에서 안쪽으로 약 ${fmt(R_SUN - armAtSun('sagittarius'), 0)}천 광년` },
        ];
        near.forEach((n) => {
          const a = ARMS.find((x) => x.id === n.id);
          const beta = n.id === 'local' ? (v.w < 8 ? -4 : -9) : v.w < 8 ? -6 : -14;
          const [x, y] = polarToXY(armRadius(a, beta), beta);
          const [X, Y] = P(x, y);
          if (X < -200 || X > w + 200 || Y < -40 || Y > h + 40) return;
          label(g, n.txt, X, Y - 9, n.id === 'local' ? '#ffe9a8' : '#a9d6ff', 15);
          label(g, n.sub, X, Y + 10, '#d5e0f7', 12.5, 'center', 500);
        });
        // 방향 안내
        const [SX, SY] = P(0, -R_SUN);
        g.globalAlpha = 0.9;
        label(g, '↑ 은하 중심 방향 (궁수자리 쪽)', SX, Math.max(24, SY - Math.min(h * 0.38, 9 * k)), '#ffc46b', 13.5);
        label(g, '↓ 은하 중심 반대 방향 (황소자리·마차부자리 쪽)', SX, Math.min(h - 70, SY + Math.min(h * 0.36, 9 * k)), '#7fd0ff', 13.5);
        g.globalAlpha = 1;
      }
      // 태양 주변 천체
      if (showObj && v.w < 12) {
        LOCAL_OBJECTS.forEach((o) => {
          const [X, Y] = P(o.xyz[0], o.xyz[1]);
          if (X < 0 || X > w || Y < 0 || Y > h) return;
          const col = { open: '#8fd0ff', emission: '#ff7aa2', dark: '#d8b48c', star: '#ffe6b0' }[o.kind];
          g.fillStyle = col;
          g.beginPath();
          g.arc(X, Y, 3.5, 0, Math.PI * 2);
          g.fill();
          if (v.w < 7 || o.d > 2000) label(g, o.name, X + 7, Y, col, 12, 'left', 600);
        });
      }
      // 예측 표시
      if (guess) {
        const [X, Y] = P(guess[0], guess[1]);
        g.strokeStyle = '#6fd39a';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(X, Y, 11, 0, Math.PI * 2);
        g.moveTo(X - 16, Y);
        g.lineTo(X + 16, Y);
        g.moveTo(X, Y - 16);
        g.lineTo(X, Y + 16);
        g.stroke();
        label(g, '내 예측', X, Y + 26, '#6fd39a', 13);
      }
      if (orbit) {
        // 공전 궤도
        const [CX, CY] = P(0, 0);
        g.strokeStyle = 'rgba(255,225,77,.55)';
        g.setLineDash([6, 7]);
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(CX, CY, R_SUN * k, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        // 회전 방향 화살표(시계 방향)
        for (let a = 45; a < 360; a += 90) {
          const [x1, y1] = polarToXY(R_SUN, a);
          const [x2, y2] = polarToXY(R_SUN, a + 6);
          const [X1, Y1] = P(x1, y1);
          const [X2, Y2] = P(x2, y2);
          const ang = Math.atan2(Y2 - Y1, X2 - X1);
          g.fillStyle = '#ffe14d';
          g.beginPath();
          g.moveTo(X2 + Math.cos(ang) * 6, Y2 + Math.sin(ang) * 6);
          g.lineTo(X2 + Math.cos(ang + 2.5) * 9, Y2 + Math.sin(ang + 2.5) * 9);
          g.lineTo(X2 + Math.cos(ang - 2.5) * 9, Y2 + Math.sin(ang - 2.5) * 9);
          g.fill();
        }
        if (years > 0) {
          const [X0, Y0] = P(0, -R_SUN);
          g.fillStyle = 'rgba(255,225,77,.35)';
          g.beginPath();
          g.arc(X0, Y0, 5, 0, Math.PI * 2);
          g.fill();
          label(g, '지금 위치', X0, Y0 + 18, 'rgba(255,225,77,.8)', 12);
        }
      }
      // 태양계
      if (showSun) {
        const pos = orbit ? sunPos : [0, -R_SUN];
        const [SX, SY] = P(pos[0], pos[1]);
        if (!orbit && v.w > 20) {
          g.strokeStyle = 'rgba(255,225,77,.85)';
          g.setLineDash([6, 6]);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(GX, GY);
          g.lineTo(SX, SY);
          g.stroke();
          g.setLineDash([]);
          label(g, '약 2만 6천 광년', (GX + SX) / 2 + 12, (GY + SY) / 2, '#ffe14d', 15, 'left');
        }
        const pulse = 9 + 3 * Math.sin(performance.now() / 300);
        g.strokeStyle = '#ffe14d';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(SX, SY, pulse, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = '#ffe14d';
        g.shadowColor = '#ffe14d';
        g.shadowBlur = 14;
        g.beginPath();
        g.arc(SX, SY, 4.5, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        label(g, '태양계', SX, SY - 22, '#ffe14d', 16, 'center', 750);
        if (guess && step === 1) {
          const [X, Y] = P(guess[0], guess[1]);
          g.strokeStyle = 'rgba(111,211,154,.7)';
          g.setLineDash([3, 5]);
          g.beginPath();
          g.moveTo(X, Y);
          g.lineTo(SX, SY);
          g.stroke();
          g.setLineDash([]);
        }
      }
    },
    [revealed, step, guess, showObj, orbit, sunPos, years],
  );

  // 태양계 표시가 맥박치도록 가끔 다시 그림
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 80);
    return () => clearInterval(id);
  }, []);

  const guessDist = guess ? Math.hypot(guess[0], guess[1] + R_SUN) : null;
  const guessR = guess ? Math.hypot(guess[0], guess[1]) : null;

  const stage = (
    <>
      <GalaxyMap ref={map} view={view} setView={setView} draw={draw} onPick={pick} frame={frame} onGesture={() => mark('m3.gesture')} />
      <ScaleNote>은하와 거리는 실제 비율이에요. 태양계·천체의 점과 고리는 위치만 표시한 것으로, 실제 크기는 이 그림에서 보이지 않을 만큼 작아요.</ScaleNote>
      {step === 1 && !revealed && (
        <div
          style={{ position: 'absolute', left: '.9rem', top: '.9rem', zIndex: 6, maxWidth: '24rem', padding: '.7rem .9rem', borderRadius: '.9rem', background: 'rgba(9,16,38,.9)', border: '1px solid rgba(111,211,154,.5)' }}
        >
          <b style={{ color: '#6fd39a' }}>예측해 보기</b>
          <div style={{ fontSize: '.92rem', color: 'var(--ink-2)' }}>태양계는 우리 은하의 어디에 있을까요? 지도에서 예상하는 곳을 눌러 보세요.</div>
        </div>
      )}
      <div className="dock">
        {step === 1 && !revealed ? (
          <button type="button" className="btn primary" onClick={reveal} disabled={!guess}>
            {guess ? '정답 확인하기' : '먼저 지도를 눌러 예측하세요'}
          </button>
        ) : (
          <>
            <button type="button" className={`btn ${step === 2 ? 'on' : ''}`} onClick={zoomIn}>
              ② 태양계 확대
            </button>
            <button type="button" className={`btn ${step === 3 ? 'on' : ''}`} onClick={arms}>
              ③ 주변 나선팔
            </button>
            <button type="button" className={`btn ${step === 4 ? 'on' : ''}`} onClick={zoomOut}>
              ④ 은하 전체로
            </button>
          </>
        )}
        <span className="sep" />
        <button
          type="button"
          className={`btn ${orbit ? 'on' : ''}`}
          onClick={() => {
            const on = !orbit;
            setOrbit(on);
            if (on) {
              setRevealed(true);
              if (step === 1) setStep(4);
              map.current?.flyTo(FULL, 1000);
            } else {
              setPlaying(false);
              setYears(0);
            }
          }}
        >
          은하 공전 보기
        </button>
      </div>
    </>
  );

  const panel = (
    <>
      <ol style={{ listStyle: 'none', padding: 0, margin: '.4rem 0' }}>
        {STEPS.map((s) => (
          <li key={s.n} style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', margin: '.35rem 0', opacity: step >= s.n || (s.n === 1) ? 1 : 0.55 }}>
            <span
              style={{
                flex: 'none', width: '1.6rem', height: '1.6rem', borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 750, fontSize: '.85rem',
                background: step === s.n ? 'var(--btn-on)' : step > s.n ? 'var(--ok)' : 'transparent', color: step >= s.n ? '#0b1530' : 'var(--ink-2)', border: '1.5px solid var(--ink-3)',
              }}
            >
              {step > s.n ? '✓' : s.n}
            </span>
            <span>
              <b style={{ display: 'block', fontSize: '.95rem' }}>{s.t}</b>
              <span style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      {revealed && step === 1 && guess && (
        <div className="card">
          <p>
            내 예측은 실제 태양계 위치에서 약 <b>{fmt(guessDist * 1000, 0)}광년</b> 떨어져 있어요.
            {guessR < 8 ? ' 은하 중심 가까이를 골랐네요. 실제 태양계는 중심에서 꽤 멀리 있어요!' : guessDist < 6 ? ' 거의 맞혔어요!' : ''}
          </p>
          <button type="button" className="btn primary" onClick={zoomIn}>
            ② 태양계로 확대하기 →
          </button>
        </div>
      )}
      <dl className="facts">
        <div>
          <dt>은하 중심까지</dt>
          <dd>
            약 2만 6천 광년<small>은하 반지름(5만 광년)의 약 절반</small>
          </dd>
        </div>
        <div>
          <dt>속한 나선팔</dt>
          <dd>
            오리온자리 팔<small>국부 팔(Local Arm)</small>
          </dd>
        </div>
      </dl>
      {step >= 3 && (
        <p>
          태양계는 큰 나선팔인 <b>페르세우스자리 팔</b>(바깥쪽)과 <b>궁수자리 팔</b>(안쪽) 사이의 작은 팔, <b>오리온자리 팔</b>에 있어요. 오리온 대성운, 플레이아데스 성단도 같은 팔에 있는 이웃이에요.
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={showObj} onChange={(e) => setShowObj(e.target.checked)} />
        확대했을 때 태양 주변 천체 보기
      </label>
      {orbit && (
        <div className="card">
          <h3>태양계의 은하 공전</h3>
          <p>
            태양계는 다른 별들과 함께 <T k="은하 중심">은하 중심</T>을 중심으로 돌고 있어요. 위(북쪽 은하극)에서 보면 <b>시계 방향</b>이에요.
          </p>
          <div className="row">
            <button type="button" className={`btn ${playing ? 'on' : 'primary'}`} onClick={() => { if (years >= YEARS_PER_ORBIT) setYears(0); setPlaying(!playing); mark('m3.orbit'); }}>
              {playing ? '❚❚ 멈춤' : '▶ 공전 재생'}
            </button>
            <input
              type="range"
              min="0"
              max={YEARS_PER_ORBIT}
              step={YEARS_PER_ORBIT / 460}
              value={years}
              onChange={(e) => { setYears(Number(e.target.value)); mark('m3.orbit'); }}
              aria-label="흐른 시간"
            />
          </div>
          <p style={{ fontVariantNumeric: 'tabular-nums' }}>
            흐른 시간: <b>{years < 1e8 ? `${fmt(years / 1e4, 0)}만 년` : `${fmt(years / 1e8, 2)}억 년`}</b> · 돈 각도: <b>{fmt(sunAngle, 0)}°</b>
          </p>
          <dl className="facts">
            <div>
              <dt>공전 속도</dt>
              <dd>
                약 220 km/s<small>1초에 서울→부산 거리(약 325 km)의 2/3쯤</small>
              </dd>
            </div>
            <div>
              <dt>공전 주기</dt>
              <dd>
                약 2억 2천만~2억 5천만 년<small>애니메이션은 약 2억 3천만 년</small>
              </dd>
            </div>
          </dl>
          <p className="note">
            태양계가 태어난 약 46억 년 동안 은하를 약 20바퀴 돌았어요. 실제로는 나선팔과 다른 별들도 함께 돌지만(빠르기는 서로 달라요), 여기서는 태양계의 움직임만 나타냈어요.
          </p>
        </div>
      )}
      <Mission
        id="m3a"
        no="3"
        question="태양계는 우리 은하의 중심에 위치할까요?"
        requires={[
          { key: 'm3.select', label: '① 은하 전체 화면에서 태양계 찾기(선택)' },
          { key: 'm3.zoomin', label: '② 태양계 위치 확대하기' },
          { key: 'm3.zoomout', label: '④ 다시 은하 전체로 축소하기' },
        ]}
        options={[
          { text: '네, 태양계는 은하의 한가운데에 있다.', hint: '지도에서 태양계(노란 점)와 은하 중심(주황 십자)의 위치를 다시 비교해 보세요.' },
          { text: '아니요, 은하 중심에서 약 2만 6천 광년 떨어진 원반의 나선팔(오리온자리 팔)에 있다.', correct: true },
          { text: '아니요, 원반을 벗어난 헤일로에 있다.', hint: '태양계는 원반 안의 나선팔에 있어요. 확대했을 때 주변에 무엇이 있었는지 떠올려 보세요.' },
          { text: '아니요, 우리 은하 바깥에 있다.', hint: '은하수가 밤하늘을 띠처럼 둘러싸 보이는 것은 우리가 은하 원반 안에 있기 때문이에요.' },
        ]}
        explain="태양계는 은하 중심이 아니라, 중심에서 약 2만 6천 광년 떨어진 원반의 한쪽(오리온자리 팔)에 있어요. 은하 반지름의 약 절반쯤 되는 곳이에요."
      />
      <Mission
        id="m3b"
        no="3-2"
        question="태양계가 은하 중심을 한 바퀴 도는 데 걸리는 시간은 대략 얼마일까요?"
        requires={[{ key: 'm3.orbit', label: '‘은하 공전 보기’를 켜고 공전을 재생해 보기' }]}
        options={[
          { text: '약 1년', hint: '1년은 지구가 태양 둘레를 한 바퀴 도는 시간이에요. 은하는 훨씬 커요!' },
          { text: '약 2만 6천 년', hint: '2만 6천은 은하 중심까지의 거리(광년)예요. 시간과 헷갈리지 마세요.' },
          { text: '약 2억 2천만~2억 5천만 년', correct: true },
          { text: '약 100억 년', hint: '공전 애니메이션의 ‘흐른 시간’이 한 바퀴일 때 얼마였는지 확인해 보세요.' },
        ]}
        explain="태양계는 약 220 km/s로 움직이지만, 은하가 워낙 커서 한 바퀴 도는 데 약 2억 2천만~2억 5천만 년이 걸려요. 이것을 ‘은하년’이라고도 해요."
        next={{ label: '다음 탐험: 계절에 따른 은하수', onClick: () => goTo(4) }}
      />
    </>
  );

  return (
    <ModuleShell
      no={meta.no}
      title={meta.title}
      goal="태양계가 우리 은하의 중심이 아닌 은하 원반의 한쪽에 위치한다는 사실을 이해한다."
      onReset={onReset}
      stage={stage}
      panel={panel}
    />
  );
}
