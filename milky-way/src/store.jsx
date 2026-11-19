import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// 학생의 조작 기록(미션 잠금 해제용)과 미션 결과. 브라우저에만 저장(실패해도 앱은 정상 동작).
const KEY = 'milkyway-explorer-v1';
const load = () => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { actions: new Set(d.actions || []), solved: d.solved || {}, teacher: !!d.teacher };
  } catch {
    return null;
  }
};
const save = (s) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ actions: [...s.actions], solved: s.solved, teacher: s.teacher }));
  } catch {
    /* 저장할 수 없는 환경: 무시 */
  }
};

const Ctx = createContext(null);

export function ProgressProvider({ children }) {
  const [state, setState] = useState(() => load() || { actions: new Set(), solved: {}, teacher: false });
  const update = useCallback((fn) => {
    setState((s) => {
      const n = fn(s);
      if (n !== s) save(n);
      return n;
    });
  }, []);
  const mark = useCallback(
    (key) =>
      update((s) => {
        if (s.actions.has(key)) return s;
        const actions = new Set(s.actions);
        actions.add(key);
        return { ...s, actions };
      }),
    [update],
  );
  const solve = useCallback((id) => update((s) => (s.solved[id] ? s : { ...s, solved: { ...s.solved, [id]: true } })), [update]);
  const setTeacher = useCallback((v) => update((s) => ({ ...s, teacher: v })), [update]);
  const resetAll = useCallback(() => update(() => ({ actions: new Set(), solved: {}, teacher: false })), [update]);
  const value = useMemo(() => ({ ...state, mark, solve, setTeacher, resetAll }), [state, mark, solve, setTeacher, resetAll]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useProgress = () => useContext(Ctx);
