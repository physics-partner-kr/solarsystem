import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './components/ui.jsx';
import { GLOSSARY } from './data/glossary.js';
import { useProgress } from './store.jsx';
import { makeGalaxyCanvas } from './lib/galaxy.js';
import LightYear from './components/LightYear.jsx';
import Module1 from './modules/m1/Module1.jsx';
import Module2 from './modules/m2/Module2.jsx';
import Module3 from './modules/m3/Module3.jsx';
import Module4 from './modules/m4/Module4.jsx';

export const MODULES = [
  { no: 1, short: '구조와 크기', title: '우리 은하의 구조와 크기', color: 'var(--c-bulge)', missions: ['m1a', 'm1b'],
    desc: '막대나선은하의 팽대부·막대·나선팔·원반·헤일로를 돌려 보고, 은하의 크기를 태양계와 비교해요.' },
  { no: 2, short: '성단과 성운', title: '성단과 성운 탐험', color: 'var(--c-open)', missions: ['m2a', 'm2b'],
    desc: '산개 성단과 구상 성단의 별 분포를 비교하고, 방출·반사·암흑 성운이 빛나는 원리를 알아봐요.' },
  { no: 3, short: '태양계의 위치', title: '우리 은하에서 태양계의 위치', color: 'var(--c-sun)', missions: ['m3a', 'm3b'],
    desc: '태양계를 찾아 확대해 보고, 은하 중심에서 얼마나 떨어져 어떻게 도는지 확인해요.' },
  { no: 4, short: '계절별 은하수', title: '계절에 따른 은하수 관측', color: 'var(--c-summer)', missions: ['m4c', 'm4d', 'm4a', 'm4b'],
    desc: '지구의 자전·공전과 은하 중심 방향을 연결해, 여름과 겨울 은하수가 다르게 보이는 까닭을 밝혀요.' },
];

const MODS = { 1: Module1, 2: Module2, 3: Module3, 4: Module4 };

function GalaxyIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="#7cc4ff" strokeWidth="3" transform="rotate(-25 32 32)" />
      <ellipse cx="32" cy="32" rx="16" ry="5" fill="none" stroke="#b3bfff" strokeWidth="2" opacity=".7" transform="rotate(-25 32 32)" />
      <circle cx="32" cy="32" r="6" fill="#ffc46b" />
    </svg>
  );
}

function Home({ go }) {
  const p = useProgress();
  const bg = useRef(null);
  const img = useMemo(() => {
    try {
      return makeGalaxyCanvas({ size: 1024, extent: 58 }).toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    const c = bg.current;
    if (!c) return;
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
          className="home-galaxy"
          style={{
            position: 'absolute', right: '-8%', top: '6%', width: 'min(62vw, 54rem)', opacity: 0.55, mixBlendMode: 'screen',
            transform: 'perspective(1400px) rotateX(58deg) rotateZ(-20deg)', pointerEvents: 'none', borderRadius: '50%',
            maskImage: 'radial-gradient(circle, #000 55%, transparent 71%)', WebkitMaskImage: 'radial-gradient(circle, #000 55%, transparent 71%)',
          }}
        />
      )}
      <div className="home-in">
        <p style={{ color: 'var(--ink-3)', margin: '0 0 .4rem', fontWeight: 650 }}>중학교 2학년 과학 · 별과 우주</p>
        <h1>우리 은하 탐험</h1>
        <p className="sub">
          우리는 은하 <b>안</b>에 살고 있어요. 그래서 우리 은하의 전체 모습을 밖에서 찍은 사진은 없답니다.
          관측 자료로 만든 모형을 직접 돌리고, 확대하고, 시간을 바꿔 가며 우리 은하를 탐험해 봐요.
        </p>
        <div className="flow">
          {MODULES.map((m) => {
            const solved = m.missions.filter((id) => p.solved[id]).length;
            return (
              <button key={m.no} type="button" className="mcard" style={{ '--c': m.color }} onClick={() => go(m.no)}>
                <span className="k">탐험 {m.no}</span>
                <b>{m.title}</b>
                <span>{m.desc}</span>
                <span className="star">{'★'.repeat(solved)}{'☆'.repeat(m.missions.length - solved)} 미션 {solved}/{m.missions.length}</span>
                <span className="go">{m.no === 1 ? '여기서 시작 →' : '탐험하기 →'}</span>
              </button>
            );
          })}
        </div>
        <div className="facts-row">
          <span>막대나선은하</span>
          <span>지름 약 10만 광년</span>
          <span>태양계 ↔ 은하 중심 약 2만 6천 광년</span>
          <span>태양계는 오리온자리 팔(국부 팔)</span>
        </div>
        <p className="keys">
          조작: 마우스 끌기·한 손가락 = 돌리기 · 휠·두 손가락 = 확대/축소 · <kbd>1</kbd>~<kbd>4</kbd> 탐험 바꾸기 · <kbd>←</kbd>
          <kbd>→</kbd> 단계 이동 · <kbd>Esc</kbd> 창 닫기 · <kbd>H</kbd> 처음 화면
        </p>
        <p className="keys">
          ⚠ 화면의 천체 크기와 거리는 잘 보이도록 단순화한 곳이 있으며, 그런 화면에는 ‘비율 안내’를 표시했어요. 사진 출처는 각 사진 아래에 적었어요.
        </p>
        {Object.keys(p.solved).length > 0 && (
          <button type="button" className="reset-btn" style={{ marginTop: '.4rem' }} onClick={() => window.confirm('미션 기록과 조작 기록을 모두 지울까요?') && p.resetAll()}>
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
    const h = Number(window.location.hash.replace('#', ''));
    return h >= 1 && h <= 4 ? h : 'home';
  });
  const [resetKeys, setResetKeys] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [modal, setModal] = useState(null);
  const go = useCallback((r) => {
    setRoute(r);
    try {
      window.history.replaceState(null, '', r === 'home' ? window.location.pathname + window.location.search : `#${r}`);
    } catch {
      /* 파일로 열었을 때 등 */
    }
    window.scrollTo(0, 0);
  }, []);
  const reset = useCallback((n) => setResetKeys((k) => ({ ...k, [n]: k[n] + 1 })), []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (['1', '2', '3', '4'].includes(e.key)) go(Number(e.key));
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

  const Mod = route !== 'home' ? MODS[route] : null;
  const meta = MODULES.find((m) => m.no === route);
  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go('home')} title="처음 화면">
          <GalaxyIcon />
          <b>우리 은하 탐험</b>
        </button>
        <nav className="modtabs" aria-label="학습 메뉴">
          {MODULES.map((m) => {
            const all = m.missions.every((id) => p.solved[id]);
            return (
              <button key={m.no} type="button" className="modtab" aria-current={route === m.no ? 'page' : undefined} onClick={() => go(m.no)}>
                <i>{m.no}</i>
                {m.short}
                {all && <span className="done" aria-label="미션 완료">✓</span>}
              </button>
            );
          })}
        </nav>
        <div className="tools">
          <button type="button" className="tool txt" onClick={() => setModal('ly')}>
            광년이란?
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
        {Mod && (
          <Mod
            key={`${route}-${resetKeys[route]}`}
            meta={meta}
            onReset={() => reset(route)}
            goTo={go}
            openLy={() => setModal('ly')}
          />
        )}
      </main>
      {modal === 'ly' && <LightYear onClose={() => setModal(null)} />}
      {modal === 'terms' && <Glossary onClose={() => setModal(null)} />}
    </div>
  );
}
