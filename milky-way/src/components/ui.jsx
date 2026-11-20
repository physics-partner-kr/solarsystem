import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY } from '../data/glossary.js';
import { useProgress } from '../store.jsx';
import { CONFIG } from '../config.js';

/** 전문 용어: 누르면 짧은 풀이가 뜬다 */
export function T({ k, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const text = GLOSSARY[k] || GLOSSARY[children];
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);
  if (!text) return <>{children}</>;
  const toggle = () => {
    const r = ref.current.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    const below = r.bottom + 8;
    const top = below + 150 > window.innerHeight ? Math.max(8, r.top - 8 - 150) : below;
    setPos({ left, top });
    setOpen((o) => !o);
  };
  return (
    <>
      <button type="button" className="term" ref={ref} onClick={toggle} aria-expanded={open}>
        {children || k}
      </button>
      {open &&
        pos &&
        createPortal(
          <div className="term-pop" style={{ left: pos.left, top: pos.top }} role="tooltip">
            <b>{k}</b>
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.color && <span className="sw" style={{ background: o.color }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="subtabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return createPortal(
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <button className="x" type="button" onClick={onClose} aria-label="닫기">
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function InfoCard({ color, title, en, onClose, children }) {
  return (
    <div className="info-card" style={{ '--c': color }} role="dialog" aria-label={title}>
      <button className="x" type="button" onClick={onClose} aria-label="설명 닫기">
        ×
      </button>
      <h3>
        {title}
        {en && <span className="en">{en}</span>}
      </h3>
      {children}
    </div>
  );
}

export function ScaleNote({ children, style }) {
  return (
    <div className="scale-note" style={style}>
      <b>⚠ 비율 안내</b> {children}
    </div>
  );
}

/** 사진: 넣어 둔 사진을 먼저 쓰고, 읽지 못하면 그림(fallback)으로 바꾼다 */
export function Photo({ src, alt, credit, fallback, tag, style, className = '', fit = 'cover' }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  return (
    <figure className={`photo ${className}`} style={{ margin: 0, ...style }}>
      {!failed ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} draggable={false} style={{ objectFit: fit }} /> : fallback}
      {tag && <span className="tag">{tag}</span>}
      {credit && <figcaption>{!failed ? credit : src ? '사진을 불러오지 못해 그림으로 대신 보여 줍니다' : '그림: 실제 천체의 모양과 색을 바탕으로 그린 그림'}</figcaption>}
    </figure>
  );
}

/** 캔버스 그림 그리기용: 요소 크기·화면 배율을 따라간다 */
export function useCanvasSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)), dpr: Math.min(2, window.devicePixelRatio || 1) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * 탐구 미션: 필요한 조작을 먼저 해야 보기가 열린다. 틀리면 힌트, 맞히면 해설.
 * requires: [{ key, label }]
 * options: [{ text, correct?, hint? }]
 */
export function Mission({ id, no, title, question, requires = [], options, explain, next }) {
  const p = useProgress();
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState([]);
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);
  const solved = !!p.solved[id];
  const doneReq = requires.filter((r) => p.actions.has(r.key)).length;
  const open = p.teacher || doneReq === requires.length || solved;
  const choose = (i) => {
    setPicked(i);
    if (options[i].correct) p.solve(id);
    else setWrong((w) => (w.includes(i) ? w : [...w, i]));
  };
  const submitCode = (e) => {
    e.preventDefault();
    if (code.trim().toLowerCase() === CONFIG.teacherCode.toLowerCase()) {
      p.setTeacher(true);
      setAskCode(false);
    } else setCodeErr(true);
  };
  const correctIdx = options.findIndex((o) => o.correct);
  const showSolved = solved && (picked === null || options[picked]?.correct);
  return (
    <section className="mission" aria-label={title || `탐구 미션 ${no}`}>
      <div className="mission-head">
        <span aria-hidden="true">🔭</span>
        <b>{title || `탐구 미션 ${no}`}</b>
        <span className={`state ${solved ? 'solved' : ''}`}>{solved ? '해결!' : open ? '도전 중' : `준비 ${doneReq}/${requires.length}`}</span>
      </div>
      <p className="q">{question}</p>
      {!open && (
        <>
          <p className="locked">먼저 아래 조작을 직접 해 보세요. 모두 하면 보기가 열려요.</p>
          <ul className="req">
            {requires.map((r) => {
              const ok = p.actions.has(r.key);
              return (
                <li key={r.key} className={ok ? 'ok' : ''}>
                  <i aria-hidden="true">{ok ? '✓' : ''}</i>
                  <span>{r.label}</span>
                </li>
              );
            })}
          </ul>
          <div className="teacher">
            {!askCode ? (
              <button type="button" className="link" onClick={() => setAskCode(true)}>
                선생님 잠금 해제
              </button>
            ) : (
              <form onSubmit={submitCode} style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                <input
                  type="password"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeErr(false);
                  }}
                  placeholder="선생님 암호"
                  aria-label="선생님 암호"
                  autoFocus
                />
                <button type="submit" className="reset-btn">
                  열기
                </button>
                {codeErr && <span style={{ color: 'var(--bad)' }}>암호가 달라요</span>}
              </form>
            )}
          </div>
        </>
      )}
      {open && (
        <div className="opts">
          {options.map((o, i) => {
            const isWrong = wrong.includes(i);
            const isRight = (solved && i === correctIdx && (picked === i || picked === null));
            return (
              <button
                key={i}
                type="button"
                className={`opt ${isWrong ? 'wrong' : ''} ${isRight ? 'right' : ''}`}
                onClick={() => choose(i)}
                disabled={isWrong || showSolved}
              >
                <span className="n">{i + 1}</span>
                <span>{o.text}</span>
              </button>
            );
          })}
        </div>
      )}
      {open && picked !== null && !options[picked].correct && (
        <div className="feedback hint" role="status">
          <b>다시 생각해 보세요.</b> {options[picked].hint || '화면을 다시 조작해 보며 확인해 보세요.'}
        </div>
      )}
      {open && showSolved && (
        <div className="feedback good" role="status">
          <b>정답이에요!</b> {explain}
        </div>
      )}
      {showSolved && next && (
        <button type="button" className="btn primary next-link" onClick={next.onClick}>
          {next.label} →
        </button>
      )}
    </section>
  );
}

/** 접근성: 키보드 화살표로 단계 이동 */
export function useArrowSteps(ids, value, onChange) {
  useEffect(() => {
    const h = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const i = ids.indexOf(value);
      if (e.key === 'ArrowRight' && i < ids.length - 1) onChange(ids[i + 1]);
      if (e.key === 'ArrowLeft' && i > 0) onChange(ids[i - 1]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ids, value, onChange]);
}

export function ModuleShell({ no, title, goal, onReset, stage, panel, stageClass = '', override }) {
  if (override) {
    no = override.no ?? no;
    title = override.title ?? title;
    goal = override.goal ?? goal;
  }
  return (
    <section className="module">
      <div className={`stage ${stageClass}`}>{stage}</div>
      <aside className="panel">
        <div className="panel-head">
          <div className="row1">
            <h1>
              {override?.kind && <span className="kind" style={{ '--c': override.color }}>{override.kind}</span>}
              {no != null && <span className="num">{no}.</span>}
              {title}
            </h1>
            <button type="button" className="reset-btn" onClick={onReset} title="이 모듈을 처음 상태로">
              ↺ 처음으로
            </button>
          </div>
          <p className="goal">
            <b>학습 목표</b>
            {goal}
          </p>
        </div>
        <div className="panel-body">{panel}</div>
      </aside>
    </section>
  );
}

export const fmt = (n, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });

/** 광년을 읽기 쉬운 한국어로 */
export function lyText(ly) {
  if (ly >= 10000) {
    const man = ly / 10000;
    return `${man >= 10 ? fmt(Math.round(man)) : fmt(man, man % 1 ? 1 : 0)}만 광년`;
  }
  if (ly >= 1) return `${fmt(ly, ly < 10 ? 1 : 0)}광년`;
  const hours = ly * 365.25 * 24;
  if (hours >= 1) return `${fmt(ly, ly < 0.01 ? 4 : 3)}광년 (빛으로 약 ${fmt(hours, hours < 10 ? 1 : 0)}시간)`;
  return `${fmt(ly, 5)}광년 (빛으로 약 ${fmt(hours * 60, 0)}분)`;
}
