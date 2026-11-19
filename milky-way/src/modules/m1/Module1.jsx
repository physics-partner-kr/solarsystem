import { useCallback, useEffect, useRef, useState } from 'react';
import Galaxy3D, { VIEWS } from './Galaxy3D.jsx';
import SizeExplorer, { LOGW_MAX, LOGW_MIN, PRESETS } from './SizeExplorer.jsx';
import { InfoCard, Mission, ModuleShell, ScaleNote, SubTabs, T, fmt, lyText, useArrowSteps } from '../../components/ui.jsx';
import { STRUCTURES } from '../../data/structures.js';
import { useProgress } from '../../store.jsx';

const TABS = [
  { id: '3d', label: '은하 모형 돌려 보기' },
  { id: 'size', label: '크기 비교' },
];
const ORDER = ['bulge', 'bar', 'arm', 'disk', 'halo', 'globular', 'sun'];

const R_MIN = 10;
const R_MAX = 460;
const toSlider = (r) => Math.round((Math.log(r / R_MIN) / Math.log(R_MAX / R_MIN)) * 100);
const fromSlider = (v) => R_MIN * Math.pow(R_MAX / R_MIN, v / 100);

export default function Module1({ meta, onReset, goTo, openLy }) {
  const p = useProgress();
  const [tab, setTab] = useState('3d');
  const [sel, setSel] = useState(null);
  const [armInfo, setArmInfo] = useState(null);
  const [halo, setHalo] = useState(true);
  const [labels, setLabels] = useState(true);
  const [measure, setMeasure] = useState(true);
  const [view, setView] = useState('start');
  const [dist, setDist] = useState(VIEWS.start.r);
  const [logW, setLogW] = useState(Math.log10(0.0016));
  const g3 = useRef(null);
  const sz = useRef(null);
  useArrowSteps(['3d', 'size'], tab, setTab);

  const pick = useCallback(
    (id, arm) => {
      setSel(id);
      setArmInfo(arm || null);
      p.mark('m1.pick');
      p.mark(`m1.pick.${id}`);
    },
    [p],
  );
  const action = useCallback((a) => p.mark(`m1.${a}`), [p]);
  const doView = (v) => {
    setView(v);
    g3.current?.setView(v);
    if (v === 'side') p.mark('m1.side');
    if (v === 'top') p.mark('m1.top');
  };

  // 크기 비교: 구간 도달 기록
  useEffect(() => {
    const W = 10 ** logW;
    if (W <= 0.003) p.mark('m1.size.sun');
    if (W >= 100000) p.mark('m1.size.galaxy');
  }, [logW, p]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && setSel(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const S = sel ? STRUCTURES[sel] : null;
  const W = 10 ** logW;

  const stage = (
    <>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === '3d' && (
        <>
          <Galaxy3D ref={g3} halo={halo} labels={labels} measure={measure} selected={sel} onPick={pick} onAction={action} onZoom={setDist} />
          <ScaleNote>
            나선팔 모양은 관측 자료로 만든 <b>모형</b>이고, 은하 반대편은 추정이에요. 태양계의 노란 점은 위치만 나타내요.
          </ScaleNote>
          {S && (
            <InfoCard color={S.color} title={armInfo ? `나선팔: ${armInfo.name}` : S.title} en={S.en} onClose={() => setSel(null)}>
              <ul>
                {S.lines.map((l, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: l }} />
                ))}
              </ul>
              {(sel === 'halo' || sel === 'globular') && (
                <button type="button" className="btn outline" onClick={() => goTo(2)}>
                  탐험 2: 구상 성단 보러 가기 →
                </button>
              )}
              {sel === 'sun' && (
                <button type="button" className="btn outline" onClick={() => goTo(3)}>
                  탐험 3: 태양계의 위치 →
                </button>
              )}
            </InfoCard>
          )}
          <div className="dock">
            <button type="button" className={`btn ${view === 'top' ? 'on' : ''}`} onClick={() => doView('top')}>
              위에서 보기
            </button>
            <button type="button" className={`btn ${view === 'side' ? 'on' : ''}`} onClick={() => doView('side')}>
              옆에서 보기
            </button>
            <button type="button" className="btn" onClick={() => { doView('reset'); setSel(null); }} title="처음 시점">
              ↺ 처음 시점
            </button>
            <span className="sep" />
            <label className="btn" style={{ cursor: 'default' }}>
              <span aria-hidden="true">－</span>
              <input
                type="range"
                min="0"
                max="100"
                value={100 - toSlider(dist)}
                onChange={(e) => {
                  const r = fromSlider(100 - Number(e.target.value));
                  g3.current?.setDistance(r);
                  setDist(r);
                  p.mark('m1.zoom');
                }}
                aria-label="확대·축소"
                style={{ width: '7.5rem' }}
              />
              <span aria-hidden="true">＋</span>
            </label>
          </div>
        </>
      )}
      {tab === 'size' && (
        <>
          <SizeExplorer ref={sz} logW={logW} setLogW={setLogW} onAction={() => p.mark('m1.size.zoom')} />
          <div className="dock">
            {PRESETS.map((pr) => (
              <button
                key={pr.id}
                type="button"
                className={`btn ${Math.abs(Math.log10(pr.w) - logW) < 0.15 ? 'on' : ''}`}
                onClick={() => sz.current?.flyTo(pr.w)}
              >
                {pr.label}
              </button>
            ))}
          </div>
          <div
            style={{ position: 'absolute', top: '4.2rem', left: '.9rem', zIndex: 5, pointerEvents: 'none', textShadow: '0 0 .6rem #03081a, 0 0 1rem #03081a' }}
          >
            <div style={{ fontSize: '.85rem', color: 'var(--ink-3)' }}>화면 가로 길이</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{lyText(W).replace(/ \(.*\)/, '')}</div>
            <div style={{ fontSize: '.9rem', color: 'var(--ink-2)' }}>빛으로 {lightTime(W)} 걸리는 거리</div>
          </div>
          <ScaleNote>별·태양의 점 크기는 실제보다 훨씬 크게 그렸어요. 거리(위치)는 실제 비율이에요.</ScaleNote>
        </>
      )}
    </>
  );

  const panel = (
    <>
      {tab === '3d' ? (
        <>
          <p>
            우리 은하는 가운데에 <b>막대</b>가 있는 <T k="막대나선은하">막대나선은하</T>예요. 은하를 끌어서 돌려 보고, 궁금한 부분을 눌러 보세요.
          </p>
          <h2>구조 살펴보기</h2>
          <div className="chips">
            {ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={sel === id}
                onClick={() => (sel === id ? setSel(null) : pick(id))}
              >
                <i style={{ background: STRUCTURES[id].color }} />
                {STRUCTURES[id].title}
              </button>
            ))}
          </div>
          <p className="note">구조를 고르면 그 부분의 별이 밝게 강조돼요. 다시 누르면 풀려요.</p>
          <h2>보기 설정</h2>
          <label className="check">
            <input type="checkbox" checked={halo} onChange={(e) => setHalo(e.target.checked)} />
            <i style={{ background: 'var(--c-halo)' }} /> <T k="헤일로">헤일로</T> 레이어 (헤일로 별·구상 성단)
          </label>
          <label className="check">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            이름표 보기
          </label>
          <label className="check">
            <input type="checkbox" checked={measure} onChange={(e) => setMeasure(e.target.checked)} />
            치수선 보기 (위·옆에서 볼 때)
          </label>
          <dl className="facts">
            <div>
              <dt>지름</dt>
              <dd>
                약 10만 광년<small>
                  <button type="button" className="term" onClick={openLy}>
                    광년이란?
                  </button>
                </small>
              </dd>
            </div>
            <div>
              <dt>원반 두께</dt>
              <dd>
                약 1천 광년<small>지름의 약 1/100</small>
              </dd>
            </div>
            <div>
              <dt>팽대부 두께</dt>
              <dd>
                약 1만 광년 이상<small>가장 두꺼운 곳</small>
              </dd>
            </div>
            <div>
              <dt>별의 수</dt>
              <dd>
                약 1000억~4000억 개<small>추정값</small>
              </dd>
            </div>
          </dl>
          <div className="card">
            <h3>태양은 어디에, 어느 쪽을 볼까?</h3>
            <p>
              옆에서 보면 태양계는 <b style={{ color: '#8fe6b4' }}>은하의 적도</b>(원반 한가운데를 지나는 평면) 가까이, 은하 중심에서 약 <b>2만 6천 광년</b> 떨어져 있어요. 원반이 아주 얇아서(실제 비율 그대로!) 우리는 이 얇은 원반 <b>안</b>에서 사방을 바라보는 셈이에요.
            </p>
            <p>
              그래서 원반 방향으로 겹쳐 보이는 별빛이 밤하늘의 <T k="은하수">은하수</T>가 되고, <b style={{ color: '#ff8a8a' }}>빨간 화살표</b>처럼 은하 중심(팽대부) 쪽을 보면 은하수가 가장 넓고 밝아요.
            </p>
            <p className="note">교과서에 따라 태양계–은하 중심 거리를 약 3만 광년으로 소개하기도 해요. 최근 관측값은 약 2만 6천 광년이에요.</p>
            <button type="button" className="btn outline" onClick={() => goTo(4)}>
              탐험 4에서 은하수로 확인하기 →
            </button>
          </div>
          <Mission
            id="m1a"
            no="1"
            question="우리 은하를 옆에서 바라보았을 때 가장 두꺼운 부분은 어디인가요?"
            requires={[
              { key: 'm1.side', label: '‘옆에서 보기’ 버튼을 눌러 은하를 옆에서 보기' },
              { key: 'm1.drag', label: '은하를 끌어서 여러 방향으로 돌려 보기' },
              { key: 'm1.pick', label: '은하의 구조를 하나 이상 눌러 설명 보기' },
            ]}
            options={[
              { text: '나선팔의 바깥쪽 끝', hint: '옆에서 보면 나선팔이 있는 원반은 아주 얇은 선처럼 보여요. 볼록하게 부풀어 오른 곳을 찾아보세요.' },
              { text: '태양계가 있는 곳', hint: '태양계는 원반 안에 있어요. 원반의 두께는 약 1천 광년으로 얇아요.' },
              { text: '은하 중심부의 팽대부', correct: true },
              { text: '헤일로의 바깥쪽 끝', hint: '헤일로는 별이 아주 드문드문 퍼진 넓은 공간이라 ‘두꺼운 구조’라고 하지 않아요. 별이 빽빽이 모여 볼록한 곳을 찾아보세요.' },
            ]}
            explain="은하 중심부의 팽대부는 별이 공(땅콩) 모양으로 볼록하게 모여 있어서 두께가 약 1만 광년 이상이에요. 원반은 약 1천 광년으로 훨씬 얇아요."
            next={{ label: '다음: 크기 비교하기', onClick: () => setTab('size') }}
          />
        </>
      ) : (
        <>
          <p>
            아래 단추를 차례로 누르거나, 화면에서 휠·두 손가락(또는 위아래로 끌기)으로 확대·축소해 보세요. 태양계에서 출발해 우리 은하 전체까지 나가 봐요.
          </p>
          <div className="row">
            <label htmlFor="m1-scale">축척</label>
            <input
              id="m1-scale"
              type="range"
              min={LOGW_MIN}
              max={LOGW_MAX}
              step="0.01"
              value={logW}
              onChange={(e) => {
                setLogW(Number(e.target.value));
                p.mark('m1.size.zoom');
              }}
            />
          </div>
          <div className="ticks" aria-hidden="true">
            <span>태양계</span>
            <span>별 사이</span>
            <span>은하</span>
          </div>
          <h2>세 가지 크기 비교</h2>
          <div className="bars">
            {[
              { n: '태양계', d: '해왕성 궤도 지름', ly: 0.00095, c: 'var(--accent)' },
              { n: '태양 ↔ 은하 중심', d: '', ly: 26000, c: 'var(--c-sun)' },
              { n: '은하 지름', d: '', ly: 100000, c: 'var(--c-disk)' },
            ].map((b) => {
              const pct = ((Math.log10(b.ly) - -4) / (5 - -4)) * 100;
              return (
                <div className="bar" key={b.n}>
                  <span style={{ fontSize: '.82rem' }}>{b.n}</span>
                  <span className="track">
                    <span className="fillb" style={{ display: 'block', width: `${pct}%`, background: b.c }} />
                  </span>
                  <output>{b.ly < 1 ? '0.001광년' : `${fmt(b.ly / 10000, 1).replace('.0', '')}만 광년`}</output>
                </div>
              );
            })}
          </div>
          <p className="note">막대 길이는 10배마다 같은 간격(로그 눈금)으로 그렸어요. 보통 눈금으로 그리면 태양계 막대는 보이지도 않아요!</p>
          <div className="card">
            <h3>얼마나 차이 날까?</h3>
            <p>
              우리 은하 지름(10만 광년)은 태양계(해왕성 궤도 지름 약 0.001광년)의 약 <b>1억 배</b>예요.
            </p>
            <p>
              태양계를 지름 2 cm짜리 동전으로 줄이면, 우리 은하는 지름 약 <b>2,000 km</b> — 한반도 남북 길이(약 1,000 km)의 2배쯤 되는 크기예요.
            </p>
          </div>
          <p className="note">
            <button type="button" className="term" onClick={openLy}>
              광년
            </button>
            은 빛이 1년 동안 가는 거리(약 9조 4600억 km)예요. 시간이 아니라 거리의 단위예요.
          </p>
          <Mission
            id="m1b"
            no="1-2"
            question="태양계(해왕성 궤도)의 크기와 우리 은하의 지름을 비교하면, 우리 은하는 대략 몇 배 클까요?"
            requires={[
              { key: 'm1.size.sun', label: '‘태양계’ 단계에서 행성 궤도 살펴보기' },
              { key: 'm1.size.galaxy', label: '‘은하 지름’ 단계까지 축소해 보기' },
            ]}
            options={[
              { text: '약 1만 배', hint: '화면 왼쪽 위 ‘화면 가로 길이’를 보며 태양계와 은하 단계를 비교해 보세요. 0.001광년과 10만 광년!' },
              { text: '약 100만 배', hint: '0.001광년 → 10만 광년은 10배씩 몇 번 커지는지 세어 보세요.' },
              { text: '약 1억 배', correct: true },
              { text: '약 1조 배', hint: '조금 지나쳤어요. 0.001광년에서 10만 광년까지 10배씩 몇 번인지 세어 보세요.' },
            ]}
            explain="0.001광년에서 10만 광년까지는 10배씩 8번 커져요(10⁸ = 1억). 태양계는 우리 은하에 비하면 정말 작은 점이에요."
            next={{ label: '다음 탐험: 성단과 성운', onClick: () => goTo(2) }}
          />
        </>
      )}
    </>
  );

  return <ModuleShell no={meta.no} title={meta.title} goal="우리 은하의 전체적인 구조와 크기를 이해한다." onReset={onReset} stage={stage} panel={panel} />;
}

function lightTime(ly) {
  const sec = ly * 365.25 * 86400;
  if (sec < 3600) return `약 ${fmt(sec / 60, 0)}분`;
  if (sec < 86400 * 2) return `약 ${fmt(sec / 3600, sec < 36000 ? 1 : 0)}시간`;
  if (ly < 1) return `약 ${fmt(sec / 86400, 0)}일`;
  if (ly < 10000) return `약 ${fmt(ly, ly < 10 ? 1 : 0)}년`;
  return `약 ${fmt(ly / 10000, ly < 100000 ? 1 : 0).replace('.0', '')}만 년`;
}
