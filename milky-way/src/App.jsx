import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, SubTabs, useArrowSteps } from './components/ui.jsx';
import { GLOSSARY } from './data/glossary.js';
import { useProgress } from './store.jsx';
import { makeGalaxyCanvas } from './lib/galaxy.js';
import LightYear from './components/LightYear.jsx';
import Module1 from './modules/m1/Module1.jsx';
import Module2 from './modules/m2/Module2.jsx';
import Module3 from './modules/m3/Module3.jsx';
import Module4 from './modules/m4/Module4.jsx';
import Intro from './sections/Intro.jsx';
import Fig9 from './sections/Fig9.jsx';
import Observe from './sections/Observe.jsx';
import Check from './sections/Check.jsx';

export const GOALS = ['우리은하의 구조와 크기를 설명할 수 있다.', '우리은하를 구성하는 성단과 성운의 특징을 비교할 수 있다.'];

// 교과서(01 우리은하, 294~297쪽) 흐름 그대로
export const SECTIONS = [
  {
    id: 'intro', no: 1, kind: '도입', short: '도입', title: '은하수를 이루는 천체는 무엇일까?', color: 'var(--gold)', missions: ['i1'],
    goal: '은하수를 이루는 천체가 무엇인지 생각하고, 은하수가 우리은하의 일부임을 안다.',
    desc: '고구려 벽화 속 견우와 직녀, 그리고 갈릴레이의 망원경으로 은하수를 들여다봐요.',
    tabs: [
      { id: 'sky', label: '① 옛사람들이 본 은하수', comp: Intro, inner: 'sky' },
      { id: 'scope', label: '② 갈릴레이의 망원경', comp: Intro, inner: 'scope' },
    ],
  },
  {
    id: 'try', no: 2, kind: '해보기', short: '해보기', title: '여름철과 겨울철의 은하수 비교하기', color: 'var(--c-summer)', missions: ['m4a', 't1', 't2'],
    goal: '여름철과 겨울철의 은하수를 비교하고, 은하수가 띠 모양으로 보이는 까닭을 설명할 수 있다.',
    desc: '우리나라에서 찍은 은하수 사진을 비교하고, 그림 9로 은하수가 띠 모양인 까닭을 생각해요.',
    tabs: [
      { id: 'photo', label: '① 사진으로 비교하기', comp: Module4, inner: 'quiz', key: 'm4' },
      { id: 'sky', label: '② 같은 시각의 하늘 비교', comp: Module4, inner: 'sky', key: 'm4' },
      { id: 'fig9', label: '③ 그림 9로 생각하기', comp: Fig9, inner: 'fig9' },
    ],
  },
  {
    id: 'shape', no: 3, kind: '개념', short: '모양과 크기', title: '우리은하의 모양과 크기', color: 'var(--c-bulge)', missions: ['m1a', 'm3a', 'm3b', 'm1b', 'm4c', 'm4b', 'm4d'],
    goal: GOALS[0],
    desc: '위·옆에서 본 우리은하(그림 10), 태양계의 위치, 크기, 그리고 은하수가 띠로 보이는 까닭을 알아봐요.',
    tabs: [
      { id: '3d', label: '그림 10', comp: Module1, inner: '3d', key: 'm1' },
      { id: 'sun', label: '태양계의 위치', comp: Module3, inner: 'sun' },
      { id: 'size', label: '크기 비교', comp: Module1, inner: 'size', key: 'm1' },
      { id: 'band', label: '띠 모양의 까닭', comp: Module4, inner: 'dir', key: 'm4' },
      { id: 'season', label: '계절과 공전', comp: Module4, inner: 'orbit', key: 'm4' },
      { id: 'spin', label: '더 알아보기', comp: Module4, inner: 'spin', key: 'm4' },
    ],
  },
  {
    id: 'observe', no: 4, kind: '탐구', short: '탐구', title: '우리은하를 구성하는 천체 관측하기', color: 'var(--c-open)', missions: ['o1', 'o2'],
    goal: '우리은하를 구성하는 천체의 종류와 특징을 비교하고 분석한다.',
    desc: '천체 관측 프로그램으로 성단과 성운을 찾아 관측하고 기록표를 채워요.',
    tabs: [{ id: 'observe', label: '천체 관측 프로그램', comp: Observe, inner: 'observe' }],
  },
  {
    id: 'members', no: 5, kind: '개념', short: '성단과 성운', title: '우리은하는 어떤 천체들로 이루어져 있을까?', color: 'var(--c-emission)', missions: ['m2a', 'm2b'],
    goal: GOALS[1],
    desc: '산개 성단과 구상 성단, 방출·반사·암흑 성운의 특징을 비교해요(그림 11).',
    tabs: [
      { id: 'cluster', label: '성단', comp: Module2, inner: 'cluster', key: 'm2' },
      { id: 'nebula', label: '성운', comp: Module2, inner: 'nebula', key: 'm2' },
      { id: 'vs', label: '성단과 성운 비교', comp: Module2, inner: 'vs', key: 'm2' },
    ],
  },
  {
    id: 'check', no: 6, kind: '확인', short: '스스로 확인', title: '스스로 확인하기', color: 'var(--ok)', missions: ['c1', 'c2', 'c3', 'c4'],
    goal: '우리은하의 구조와 크기, 성단과 성운의 특징을 스스로 확인한다.',
    desc: '배운 내용을 문제로 확인하고, 이것만은 꼭 기억해요.',
    tabs: [{ id: 'check', label: '스스로 확인하기', comp: Check, inner: 'check' }],
  },
];
const IDS = SECTIONS.map((s) => s.id);
const META = { no: null, title: '' };

function GalaxyIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="#7cc4ff" strokeWidth="3" transform="rotate(-25 32 32)" />
      <ellipse cx="32" cy="32" rx="16" ry="5" fill="none" stroke="#b3bfff" strokeWidth="2" opacity=".7" transform="rotate(-25 32 32)" />
      <circle cx="32" cy="32" r="6" fill="#ffc46b" />
    </svg>
  );
}

function Section({ sec, initialTab, nav, go, openLy, resetKey, onReset }) {
  const [tab, setTab] = useState(initialTab && sec.tabs.some((t) => t.id === initialTab) ? initialTab : sec.tabs[0].id);
  useEffect(() => {
    if (nav?.tab && sec.tabs.some((t) => t.id === nav.tab)) setTab(nav.tab);
  }, [nav, sec]);
  const ids = useMemo(() => sec.tabs.map((t) => t.id), [sec]);
  useArrowSteps(ids, tab, setTab);
  const t = sec.tabs.find((x) => x.id === tab) || sec.tabs[0];
  const subtabs = sec.tabs.length > 1 ? <SubTabs tabs={sec.tabs} value={tab} onChange={setTab} /> : null;
  const onTab = (x) => {
    const m = sec.tabs.find((y) => y.id === x) || sec.tabs.find((y) => y.comp === t.comp && y.inner === x);
    if (m) setTab(m.id);
    else {
      const other = SECTIONS.find((s) => s.tabs.some((y) => y.id === x || y.inner === x));
      if (other) go(other.id, (other.tabs.find((y) => y.id === x) || other.tabs.find((y) => y.inner === x)).id);
    }
  };
  const Comp = t.comp;
  const shell = { no: sec.no, title: sec.title, goal: sec.goal, kind: sec.kind, color: sec.color };
  return (
    <Comp
      key={`${sec.id}-${t.key || t.id}-${resetKey}`}
      meta={META}
      shell={shell}
      tab={t.inner}
      subtabs={subtabs}
      onTab={onTab}
      goTo={go}
      openLy={openLy}
      onReset={onReset}
    />
  );
}

function Home({ go }) {
  const p = useProgress();
  const bg = useRef(null);
  const [goalCheck, setGoalCheck] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('milkyway-goals') || '[false,false]');
    } catch {
      return [false, false];
    }
  });
  const toggleGoal = (i) =>
    setGoalCheck((g) => {
      const n = g.map((v, k) => (k === i ? !v : v));
      try {
        window.localStorage.setItem('milkyway-goals', JSON.stringify(n));
      } catch {
        /* 저장 불가 */
      }
      return n;
    });
  const img = useMemo(() => {
    try {
      return makeGalaxyCanvas({ size: 1024, extent: 58 }).toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    const c = bg.current;
    if (!c) return undefined;
    const draw = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      const g = c.getContext('2d');
      g.fillStyle = '#040a17';
      g.fillRect(0, 0, c.width, c.height);
      let s = 7;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 900; i++) {
        const a = rnd() * 0.8 + 0.1;
        g.fillStyle = `rgba(${200 + rnd() * 55},${210 + rnd() * 45},255,${a * a})`;
        const z = rnd() < 0.06 ? 2 : 1;
        g.fillRect(rnd() * c.width, rnd() * c.height, z * dpr, z * dpr);
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);
  return (
    <div className="home">
      <canvas ref={bg} className="home-bg" aria-hidden="true" />
      {img && (
        <img
          src={img}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', right: '-8%', top: '4%', width: 'min(58vw, 50rem)', opacity: 0.5, mixBlendMode: 'screen',
            transform: 'perspective(1400px) rotateX(58deg) rotateZ(-20deg)', pointerEvents: 'none', borderRadius: '50%',
            maskImage: 'radial-gradient(circle, #000 55%, transparent 71%)', WebkitMaskImage: 'radial-gradient(circle, #000 55%, transparent 71%)',
          }}
        />
      )}
      <div className="home-in">
        <p style={{ color: 'var(--ink-3)', margin: '0 0 .4rem', fontWeight: 650 }}>Ⅶ. 별과 우주 · 2. 우주</p>
        <div className="cover-title">
          <span className="cover-no">01</span>
          <h1>우리은하</h1>
        </div>
        <div className="cover-goals">
          <b>이 단원에서 나는</b>
          {GOALS.map((g, i) => (
            <label key={g} className="check">
              <input type="checkbox" checked={!!goalCheck[i]} onChange={() => toggleGoal(i)} />
              {g}
            </label>
          ))}
        </div>
        <p className="sub">
          우리은하의 모습과 크기는 어떠할까? 우리은하는 어떤 천체들로 이루어져 있을까? 교과서 순서대로 직접 돌려 보고, 관측하고, 비교하며 알아보자.
        </p>
        <div className="flow flow6">
          {SECTIONS.map((s) => {
            const solved = s.missions.filter((id) => p.solved[id]).length;
            return (
              <button key={s.id} type="button" className="mcard" style={{ '--c': s.color }} onClick={() => go(s.id)}>
                <span className="k">
                  {s.no}. {s.kind}
                </span>
                <b>{s.title}</b>
                <span>{s.desc}</span>
                <span className="star">
                  {'★'.repeat(solved)}
                  {'☆'.repeat(s.missions.length - solved)}
                </span>
                <span className="go">{s.no === 1 ? '여기서 시작 →' : '들어가기 →'}</span>
              </button>
            );
          })}
        </div>
        <p className="keys">
          조작: 마우스 끌기·한 손가락 = 돌리기 · 휠·두 손가락 = 확대/축소 · <kbd>1</kbd>~<kbd>6</kbd> 차례 바꾸기 · <kbd>←</kbd>
          <kbd>→</kbd> 단계 이동 · <kbd>Esc</kbd> 창 닫기 · <kbd>H</kbd> 처음 화면
        </p>
        <p className="keys">
          ⚠ 화면의 천체 크기와 거리는 잘 보이도록 단순화한 곳이 있으며, 그런 화면에는 ‘비율 안내’를 표시했어요. 수치는 교과서 값(지름 약 30000 pc, 태양계–은하 중심 약 8500 pc)을 따랐어요.
        </p>
        {Object.keys(p.solved).length > 0 && (
          <button type="button" className="reset-btn" style={{ marginTop: '.4rem' }} onClick={() => window.confirm('문제 기록과 조작 기록을 모두 지울까요?') && p.resetAll()}>
            기록 모두 지우기
          </button>
        )}
      </div>
    </div>
  );
}

function Glossary({ onClose }) {
  return (
    <Modal title="용어 사전" onClose={onClose}>
      <dl style={{ margin: 0 }}>
        {Object.entries(GLOSSARY).map(([k, v]) => (
          <div key={k} style={{ padding: '.45rem 0', borderBottom: '1px solid var(--line)' }}>
            <dt style={{ fontWeight: 700, color: 'var(--gold)' }}>{k}</dt>
            <dd style={{ margin: '.15rem 0 0', color: 'var(--ink-2)', fontSize: '.92rem' }}>{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

export default function App() {
  const p = useProgress();
  const [route, setRoute] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return IDS.includes(h) ? h : 'home';
  });
  const [nav, setNav] = useState(null);
  const [resetKeys, setResetKeys] = useState({});
  const [modal, setModal] = useState(null);
  const go = useCallback((r, tab) => {
    setRoute(r);
    setNav(tab ? { tab, n: Math.random() } : null);
    try {
      window.history.replaceState(null, '', r === 'home' ? window.location.pathname + window.location.search : `#${r}`);
    } catch {
      /* 파일로 열었을 때 등 */
    }
    window.scrollTo(0, 0);
  }, []);
  const reset = useCallback((r) => setResetKeys((k) => ({ ...k, [r]: (k[r] || 0) + 1 })), []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= SECTIONS.length) go(SECTIONS[n - 1].id);
      if (e.key === 'h' || e.key === 'H' || e.key === 'Home') go('home');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [go]);

  const toggleFull = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } catch {
      /* 지원하지 않는 브라우저 */
    }
  };

  const sec = SECTIONS.find((s) => s.id === route);
  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go('home')} title="처음 화면">
          <GalaxyIcon />
          <b>01 우리은하</b>
        </button>
        <nav className="modtabs" aria-label="학습 차례">
          {SECTIONS.map((s) => {
            const all = s.missions.every((id) => p.solved[id]);
            return (
              <button key={s.id} type="button" className="modtab" aria-current={route === s.id ? 'page' : undefined} onClick={() => go(s.id)}>
                <i>{s.no}</i>
                {s.short}
                {all && <span className="done" aria-label="모두 해결">✓</span>}
              </button>
            );
          })}
        </nav>
        <div className="tools">
          <button type="button" className="tool txt" onClick={() => setModal('ly')}>
            광년·파섹
          </button>
          <button type="button" className="tool txt" onClick={() => setModal('terms')}>
            용어 사전
          </button>
          <button type="button" className="tool icon" onClick={toggleFull} title="전체 화면" aria-label="전체 화면">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </header>
      <main>
        {route === 'home' && <Home go={go} />}
        {sec && (
          <Section
            key={sec.id}
            sec={sec}
            initialTab={nav?.tab}
            nav={nav}
            go={go}
            openLy={() => setModal('ly')}
            resetKey={resetKeys[sec.id] || 0}
            onReset={() => reset(sec.id)}
          />
        )}
      </main>
      {modal === 'ly' && <LightYear onClose={() => setModal(null)} />}
      {modal === 'terms' && <Glossary onClose={() => setModal(null)} />}
    </div>
  );
}
