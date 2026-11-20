import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SkyView from '../modules/m4/SkyView.jsx';
import { Mission, ModuleShell, Photo, ScaleNote, T } from '../components/ui.jsx';
import { FEATURES, OBJECTS, TYPES, TYPE_FEATURES, judgeRecord } from '../data/objects.js';
import { OBJECT_PHOTOS } from '../data/photos.js';
import { artURL } from '../lib/art.js';
import { eqToHor, lstDeg, OBSERVER, kstDate } from '../lib/astro.js';
import { useProgress } from '../store.jsx';

function tonight() {
  const k = new Date(Date.now() + 9 * 3600000);
  return kstDate(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate(), 21);
}

function ObjImage({ obj }) {
  const P = OBJECT_PHOTOS[obj.photo] || {};
  const art = useMemo(() => artURL(obj.art, 640, 480), [obj.art]);
  return (
    <Photo
      key={obj.id}
      src={P.src}
      alt={obj.name}
      credit={P.src ? P.credit : '그림: 실제 천체의 모양과 색을 바탕으로 그린 그림'}
      fallback={art ? <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      style={{ aspectRatio: '4 / 3' }}
    />
  );
}

const FACES = ['😊', '😐', '☹️'];

export default function Observe({ shell, goTo }) {
  const p = useProgress();
  const { mark } = p;
  const date = useMemo(tonight, []);
  const [view, setView] = useState({ az0: 180, alt0: 30, fovV: 80 });
  const [noGround, setNoGround] = useState(false);
  const [q, setQ] = useState('');
  const [openList, setOpenList] = useState(false);
  const [sel, setSel] = useState(null);
  const [feat, setFeat] = useState([]);
  const [type, setType] = useState('');
  const [records, setRecords] = useState({}); // id → { features, type, ok }
  const [msg, setMsg] = useState(null);
  const [self, setSelf] = useState({});
  const anim = useRef(0);

  const obj = OBJECTS.find((o) => o.id === sel);
  const lst = lstDeg(date);
  const hor = obj ? eqToHor(obj.ra, obj.dec, lst, OBSERVER.lat) : null;

  const flyTo = useCallback(
    (o) => {
      const h = eqToHor(o.ra, o.dec, lstDeg(date), OBSERVER.lat);
      cancelAnimationFrame(anim.current);
      const from = { ...view };
      const fov = 50;
      // 설명 창이 오른쪽을 가리므로, 천체가 화면 왼쪽 1/3쯤에 오도록 방향을 옮김
      const to = { az0: (h.az + fov * 0.32 + 360) % 360, alt0: Math.max(-90 + fov / 2, Math.min(90 - fov / 2, h.alt)), fovV: fov };
      let da = ((to.az0 - from.az0 + 540) % 360) - 180;
      const t0 = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / 1100);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setView({ az0: (from.az0 + da * k + 360) % 360, alt0: from.alt0 + (to.alt0 - from.alt0) * k, fovV: from.fovV + (to.fovV - from.fovV) * k });
        if (t < 1) anim.current = requestAnimationFrame(step);
      };
      step();
    },
    [date, view],
  );
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const choose = (o) => {
    setSel(o.id);
    setOpenList(false);
    setQ('');
    const r = records[o.id];
    setFeat(r ? r.features : []);
    setType(r ? r.type : '');
    setMsg(null);
    flyTo(o);
    mark('obs.search');
  };

  const marks = useMemo(
    () =>
      OBJECTS.map((o) => ({
        id: o.id,
        ra: o.ra,
        dec: o.dec,
        label: o.name,
        color: records[o.id]?.ok ? TYPES[o.type].color : '#d6ecff',
        r: 8,
      })),
    [records],
  );

  const save = () => {
    if (!obj) return;
    const j = judgeRecord(obj, feat, type);
    setRecords((r) => ({ ...r, [obj.id]: { features: feat, type, ok: j.ok } }));
    mark('obs.record');
    if (j.ok) setMsg({ ok: true, text: '기록표에 적었어요. 관찰한 특징과 종류가 알맞아요!' });
    else if (j.reason === 'type')
      setMsg({ ok: false, text: '종류를 다시 생각해 보세요. 별들이 모여 있나요, 구름처럼 퍼져 있나요? 성운이라면 빛을 내나요, 반사하나요, 가리나요?' });
    else if (j.reason === 'missing') setMsg({ ok: false, text: '이 종류를 구별하는 가장 중요한 특징이 빠졌어요. 사진을 다시 자세히 보세요.' });
    else if (j.reason === 'extra') setMsg({ ok: false, text: '이 천체와 맞지 않는 특징이 섞여 있어요. 사진에서 실제로 보이는 것만 골라 보세요.' });
    else setMsg({ ok: false, text: '특징과 종류를 모두 골라 주세요.' });
  };

  const okList = Object.entries(records).filter(([, r]) => r.ok).map(([id]) => OBJECTS.find((o) => o.id === id));
  const okClusters = okList.filter((o) => TYPES[o.type].group === '성단');
  const okNebulae = okList.filter((o) => TYPES[o.type].group === '성운');
  const clusterKinds = new Set(okClusters.map((o) => o.type));
  useEffect(() => {
    if (okClusters.length >= 2) mark('obs.cluster2');
    if (clusterKinds.size >= 2) mark('obs.clusterBoth');
    if (okNebulae.length >= 3) mark('obs.nebula3');
  }, [okClusters.length, okNebulae.length, clusterKinds.size, mark]);
  useEffect(() => {
    if (noGround) mark('obs.noground');
  }, [noGround, mark]);

  const list = OBJECTS.filter((o) => !q || (o.name + o.code + o.con).toLowerCase().includes(q.trim().toLowerCase()));
  const tbl = (group) =>
    Object.entries(records)
      .map(([id, r]) => ({ o: OBJECTS.find((x) => x.id === id), r }))
      .filter(({ r }) => r.type && TYPES[r.type].group === group);

  const stage = (
    <>
      <SkyView
        date={date}
        mode="pano"
        az0={view.az0}
        alt0={view.alt0}
        fovV={view.fovV}
        onPan={(v) => {
          cancelAnimationFrame(anim.current);
          setView((s) => ({ ...s, ...v }));
          mark('obs.pan');
        }}
        onZoom={(f) => setView((s) => ({ ...s, fovV: f, alt0: Math.max(-90 + f / 2, Math.min(90 - f / 2, s.alt0)) }))}
        noGround={noGround}
        lines
        names
        galEq={false}
        light={0}
        twilight={false}
        marks={marks}
        selected={sel}
        onPick={(id) => choose(OBJECTS.find((o) => o.id === id))}
        title="천체 관측 프로그램"
        sub={`서울 · 오늘 밤 9시 · ${noGround ? '지평선 없앰' : '지평선 있음'}`}
        accent="#9fe0ff"
      />
      <div className="obs-tools">
        <div className="obs-search">
          <span aria-hidden="true">🔍</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpenList(true);
            }}
            onFocus={() => setOpenList(true)}
            placeholder="천체 검색 (예: 벌집, NGC 6888)"
            aria-label="천체 검색"
          />
          <button type="button" className="reset-btn" onClick={() => setOpenList(!openList)} aria-expanded={openList}>
            목록
          </button>
        </div>
        {openList && (
          <ul className="obs-list" role="listbox">
            {['성단', '성운'].map((gname) => (
              <li key={gname} className="obs-group">
                <b>{gname}</b>
                <ul>
                  {list
                    .filter((o) => (gname === '성단' ? ['open', 'globular'] : ['emission', 'reflection', 'dark']).includes(o.type))
                    .map((o) => (
                      <li key={o.id}>
                        <button type="button" onClick={() => choose(o)}>
                          {o.name} <small>{o.code}</small>
                          {o.textbook && <em>교과서</em>}
                          {records[o.id] && <span className={records[o.id].ok ? 'ok' : 'no'}>{records[o.id].ok ? '✓' : '·'}</span>}
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <label className="obs-toggle">
          <input type="checkbox" checked={noGround} onChange={(e) => setNoGround(e.target.checked)} />
          설정 → 지평선 없애기
        </label>
      </div>
      {obj && (
        <div key={obj.id} className="info-card obs-card" style={{ '--c': '#9fe0ff' }}>
          <button className="x" type="button" onClick={() => setSel(null)} aria-label="닫기">
            ×
          </button>
          <h3>
            {obj.name} <span className="en">{obj.code}</span>
          </h3>
          <ObjImage obj={obj} />
          <p style={{ marginTop: '.45rem' }}>
            {obj.con} · {obj.dist}
            {hor && (
              <>
                <br />
                <small style={{ color: hor.alt > 0 ? 'var(--ok)' : 'var(--warn)' }}>
                  지금 고도 {Math.round(hor.alt)}° {hor.alt > 0 ? '(지평선 위)' : '(지평선 아래 — 지평선을 없애야 보여요)'}
                </small>
              </>
            )}
          </p>
          <p className="note">{obj.note}</p>
          <div className="obs-form">
            <b>관찰된 특징</b>
            <div className="chips">
              {Object.entries(FEATURES).map(([k, t]) => (
                <button key={k} type="button" className="chip" aria-pressed={feat.includes(k)} onClick={() => setFeat((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]))}>
                  {t}
                </button>
              ))}
            </div>
            <b>천체의 종류</b>
            <div className="chips">
              {Object.entries(TYPES).map(([k, t]) => (
                <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setType(k)}>
                  <i style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
            <button type="button" className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: '.4rem' }} onClick={save}>
              기록표에 적기
            </button>
            {msg && <div className={`feedback ${msg.ok ? 'good' : 'hint'}`}>{msg.text}</div>}
          </div>
        </div>
      )}
      <ScaleNote style={{ top: 'auto', bottom: '4.9rem', right: '.8rem' }}>
        별 위치는 실제 자료로 계산했어요. 천체 사진이 없는 것은 실제 모양과 색을 바탕으로 그린 그림이에요.
      </ScaleNote>
      <div className="dock">
        <button type="button" className="btn" onClick={() => setView((s) => ({ ...s, fovV: Math.max(15, s.fovV / 1.4) }))}>
          ＋ 확대
        </button>
        <button type="button" className="btn" onClick={() => setView((s) => ({ ...s, fovV: Math.min(100, s.fovV * 1.4), alt0: Math.max(-90 + Math.min(100, s.fovV * 1.4) / 2, Math.min(90 - Math.min(100, s.fovV * 1.4) / 2, s.alt0)) }))}>
          － 축소
        </button>
        <button type="button" className="btn" onClick={() => setView({ az0: 180, alt0: 30, fovV: 80 })}>
          ↺ 남쪽 하늘
        </button>
      </div>
    </>
  );

  const row = ({ o, r }) => {
    const shown = r.features.map((f) => FEATURES[f].replace(/\.$/, '')).join(', ');
    return (
      <tr key={o.id}>
        <td style={{ color: 'var(--ink)' }}>
          <button type="button" className="term" onClick={() => choose(o)}>
            {o.name}
          </button>
        </td>
        <td>{shown || '—'}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {TYPES[r.type]?.name} <b style={{ color: r.ok ? 'var(--ok)' : 'var(--bad)' }}>{r.ok ? '○' : '×'}</b>
        </td>
      </tr>
    );
  };

  const panel = (
    <>
      <div className="tb-box">
        <p>
          <b>목표</b> 우리은하를 구성하는 천체의 종류와 특징을 비교하고 분석한다.
        </p>
        <p>
          <b>준비물</b> 스마트 기기, 천체 관측 프로그램(이 화면)
        </p>
      </div>
      <p>
        우리은하에는 많은 수의 별이 좁은 공간에 모여 집단을 이루는 <T k="성단">성단</T>이 있어요. 별과 별 사이의 공간에는 기체와 먼지가 희박하게 퍼져 있는데, 이를 <T k="성간 물질">성간 물질</T>이라고 해요. 성간 물질이 모여 있어 구름처럼 보이는 천체를 <T k="성운">성운</T>이라고 해요.
      </p>
      <h2>과정</h2>
      <ol className="tb-steps">
        <li className={p.actions.has('obs.noground') ? 'done' : ''}>
          천체 관측 프로그램에서 <b>‘설정 → 지평선 없애기’</b>를 켠다. <small>(남쪽 하늘의 천체도 볼 수 있어요)</small>
        </li>
        <li className={p.actions.has('obs.search') ? 'done' : ''}>
          검색 칸이나 <b>목록</b>에서 교과서 예시 천체를 찾아 관측한다.
          <div className="note">성단: 벌집 성단, 큰부리새자리 47, 센타우루스자리 오메가 성단, 보석 상자 · 성운: 런닝맨 성운, 석탄 포대 성운, 달리는 닭 성운, 초승달 성운, 아이리스 성운</div>
        </li>
        <li className={p.actions.has('obs.record') ? 'done' : ''}>천체의 특징과 종류를 골라 <b>기록표</b>에 적는다.</li>
      </ol>
      <h2>기록표</h2>
      <table className="cmp tb-table">
        <thead>
          <tr>
            <th>천체 이름</th>
            <th>관찰된 공통 특징</th>
            <th>천체의 종류</th>
          </tr>
        </thead>
        {['성단', '성운'].map((gname) => (
          <tbody key={gname}>
            <tr className="tb-group">
              <td colSpan={3}>
                {gname} {gname === '성단' ? `(${okClusters.length}/2 이상)` : `(${okNebulae.length}/3 이상)`}
              </td>
            </tr>
            {tbl(gname).length ? tbl(gname).map(row) : (
              <tr>
                <td colSpan={3} className="note">
                  아직 기록이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
      <p className="note">○ = 특징과 종류가 알맞음, × = 다시 관찰해 보기(천체 이름을 누르면 다시 볼 수 있어요)</p>
      <h2>정리</h2>
      <Mission
        id="o1"
        title="정리 1"
        question="성단과 성운의 차이점을 설명한 것으로 옳은 것은?"
        requires={[
          { key: 'obs.cluster2', label: '성단 2개 이상 기록하기' },
          { key: 'obs.nebula3', label: '성운 3개 이상 기록하기' },
        ]}
        options={[
          { text: '성단은 기체와 먼지가 모인 것이고, 성운은 별들이 모인 것이다.', hint: '거꾸로 되었어요. 기록표에서 성단의 특징이 무엇이었는지 보세요.' },
          { text: '성단은 많은 별들이 모여 집단을 이룬 것이고, 성운은 성간 물질(기체와 먼지)이 모여 구름처럼 보이는 것이다.', correct: true },
          { text: '성단과 성운은 모두 별의 집단이고, 크기만 다르다.', hint: '성운 사진에서 별이 모여 있었나요, 구름처럼 퍼져 있었나요?' },
        ]}
        explain="성단은 많은 별이 좁은 공간에 모여 있는 별의 집단이고, 성운은 성간 물질이 모여 구름처럼 보이는 천체예요."
      />
      <Mission
        id="o2"
        title="정리 2"
        question="두 종류의 성단(산개 성단, 구상 성단)을 비교한 것으로 옳은 것은?"
        requires={[{ key: 'obs.clusterBoth', label: '산개 성단과 구상 성단을 각각 1개 이상 기록하기' }]}
        options={[
          { text: '산개 성단은 별들이 공 모양으로 빽빽하고, 구상 성단은 일정한 모양 없이 흩어져 있다.', hint: '‘구상(球狀)’은 공 모양이라는 뜻이에요. 기록표를 다시 보세요.' },
          { text: '산개 성단은 별들이 일정한 모양 없이 모여 있고 주로 파란색 별, 구상 성단은 별들이 공 모양으로 빽빽하고 주로 붉은색 별로 이루어져 있다.', correct: true },
          { text: '두 성단은 별의 수와 색이 모두 같다.', hint: '벌집 성단과 오메가 성단의 사진을 나란히 떠올려 보세요.' },
        ]}
        explain="산개 성단은 수십~수만 개의 별이 일정한 모양 없이 모여 있고 파란색의 젊은 별이 많아요. 구상 성단은 수만~수십만 개의 별이 공 모양으로 빽빽하게 모여 있고 붉은색의 늙은 별이 많아요."
        next={{ label: '다음: 성단과 성운 자세히 알아보기', onClick: () => goTo('members') }}
      />
      <div className="card">
        <h3>스스로 평가</h3>
        {[
          ['과정·기능', '스마트 기기로 관측한 성단과 성운을 분류할 수 있는가?'],
          ['가치·태도', '우리은하의 다양한 천체에 대한 아름다움, 신비로움, 경이로움을 인식하였는가?'],
        ].map(([k, t]) => (
          <div key={k} style={{ margin: '.4rem 0' }}>
            <p style={{ margin: 0 }}>
              <span className="pill">{k}</span> {t}
            </p>
            <div style={{ display: 'flex', gap: '.3rem', marginTop: '.2rem' }}>
              {FACES.map((f) => (
                <button key={f} type="button" className="chip" aria-pressed={self[k] === f} onClick={() => setSelf((s) => ({ ...s, [k]: f }))} aria-label={f}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return <ModuleShell override={shell} stage={stage} panel={panel} onReset={() => { setRecords({}); setSel(null); setView({ az0: 180, alt0: 30, fovV: 80 }); setNoGround(false); }} />;
}

export { TYPE_FEATURES };
