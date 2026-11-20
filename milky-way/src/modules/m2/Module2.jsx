import { useCallback, useEffect, useMemo, useState } from 'react';
import ClusterCanvas, { boxCount } from './ClusterCanvas.jsx';
import NebulaDiagram from './NebulaDiagram.jsx';
import { Mission, ModuleShell, Photo, ScaleNote, Seg, SubTabs, T, useArrowSteps } from '../../components/ui.jsx';
import { PHOTOS } from '../../data/photos.js';
import { artURL } from '../../lib/art.js';
import { useProgress } from '../../store.jsx';

const TABS = [
  { id: 'cluster', label: '성단 탐험' },
  { id: 'nebula', label: '성운 탐험' },
  { id: 'vs', label: '성단 vs 성운' },
];

export const CLUSTERS = {
  pleiades: {
    type: 'open', name: '좀생이성단', alt: '플레이아데스 성단 · M45', photo: 'pleiades',
    facts: [['별자리', '황소자리'], ['거리', '약 140 pc(약 440광년)'], ['나이', '약 1억 년'], ['별의 수', '1000개 이상']],
    note: '맨눈으로도 별 6~7개가 모여 보여요. 우리 조상들은 ‘좀생이별’이라고 불렀어요. 사진 속 푸른 안개는 성단 둘레의 먼지가 별빛을 반사한 <b>반사 성운</b>이에요.',
  },
  hyades: {
    type: 'open', name: '히아데스 성단', alt: 'Melotte 25', photo: 'hyades',
    facts: [['별자리', '황소자리'], ['거리', '약 47 pc(약 150광년)'], ['나이', '약 6억 년'], ['별의 수', '수백 개']],
    note: '가장 가까운 산개 성단 중 하나로, 황소의 얼굴처럼 V자 모양으로 별이 늘어서 있어요. 밝은 주황색 별 알데바란은 성단보다 훨씬 가까이 있는 별로, 성단의 구성원이 아니에요.',
  },
  m80: {
    type: 'globular', name: 'NGC 6093', alt: 'M80 · 전갈자리', photo: 'm80',
    facts: [['별자리', '전갈자리'], ['거리', '약 10000 pc(약 3만 2천 광년)'], ['나이', '약 120억 년'], ['별의 수', '수십만 개']],
    note: '수십만 개의 별이 공 모양으로 아주 빽빽하게 모여 있는 구상 성단이에요. 붉은색·노란색의 늙은 별이 많아요.',
  },
  m13: {
    type: 'globular', name: '헤르쿨레스자리 구상 성단', alt: 'M13 · 헤라클레스 구상 성단', photo: 'm13',
    facts: [['별자리', '헤르쿨레스자리'], ['거리', '약 6800 pc(약 2만 2천 광년)'], ['나이', '약 120억 년'], ['별의 수', '수십만 개']],
    note: '지름 약 145광년 안에 수십만 개의 별이 공 모양으로 빽빽하게 모여 있어요. 여름철 밤하늘에서 망원경으로 볼 수 있는 대표적인 구상 성단이에요.',
  },
};

export const NEBULAE = {
  emission: {
    name: '방출 성운', color: 'var(--c-emission)', example: '장미성운 (NGC 2237)', photo: 'rosette', diagram: 'emission',
    alt: { example: '오리온 대성운 (M42)', photo: 'orion' },
    facts: [['빛', '스스로 붉은빛을 냄'], ['색', '붉은색'], ['예', '장미성운, 오리온 대성운'], ['특징', '고온의 별에서 에너지를 받음']],
    lines: [
      '성운은 주로 우리은하의 <b>나선팔</b>에 분포해요.',
      '방출 성운은 근처에 있는 <b>고온의 별로부터 에너지를 받아 붉은빛</b>을 내요.',
      '장미성운 가운데에는 젊고 뜨거운 별들의 무리(산개 성단)가 있어, 둘레의 기체를 빛나게 해요.',
    ],
  },
  reflection: {
    name: '반사 성운', color: 'var(--c-reflection)', example: '마귀할멈성운 (IC 2118)', photo: 'witchhead', diagram: 'reflection',
    alt: { example: '좀생이성단 둘레의 반사 성운', photo: 'pleiades' },
    facts: [['빛', '주변 별빛을 반사'], ['색', '파란색'], ['예', '마귀할멈성운'], ['특징', '먼지가 별빛을 반사']],
    lines: [
      '반사 성운은 <b>주변의 별빛을 반사하여 파란빛</b>을 내요. 성운 스스로는 빛을 내지 못해요.',
      '마귀할멈성운은 가까이 있는 밝은 별 리겔의 빛을 반사해요.',
      '파란빛이 더 잘 흩어지기 때문에 파랗게 보여요(낮 하늘이 파란 까닭과 비슷해요).',
    ],
  },
  dark: {
    name: '암흑 성운', color: 'var(--c-dark)', example: '말머리성운 (오리온자리)', photo: 'horsehead', diagram: 'dark',
    facts: [['빛', '뒤에서 오는 별빛을 가림'], ['색', '검은색'], ['예', '말머리성운'], ['특징', '짙은 기체와 먼지']],
    lines: [
      '암흑 성운은 <b>뒤에서 오는 별빛을 가리기 때문에 검게</b> 보여요.',
      '말머리성운은 뒤쪽의 붉은 방출 성운 앞에 있어서, 말 머리 모양의 검은 그림자로 보여요.',
      '은하수 사이사이의 검은 틈도 이런 먼지 구름 때문이에요.',
    ],
  },
};

function ArtImg({ kind }) {
  const url = useMemo(() => artURL(kind, 720, 480), [kind]);
  return url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null;
}

function PhotoOf({ k, tag, style, fit }) {
  const P = PHOTOS[k];
  return <Photo key={k} src={P.src} alt={tag || k} credit={P.credit} fallback={<ArtImg kind={P.art} />} tag={tag} style={style} fit={fit} />;
}

const NO_KEYS = [];

export default function Module2({ meta, onReset, goTo, tab: ctlTab, onTab, subtabs, shell }) {
  const p = useProgress();
  const [tabSt, setTabSt] = useState('cluster');
  const tab = ctlTab || tabSt;
  const setTab = ctlTab ? (t) => onTab?.(t) : setTabSt;
  const [cmode, setCmode] = useState('open'); // open | globular | both
  const [obj, setObj] = useState({ open: 'pleiades', globular: 'm80' });
  const [box, setBox] = useState(false);
  const [same, setSame] = useState(true);
  const [neb, setNeb] = useState('emission');
  useArrowSteps(ctlTab ? NO_KEYS : ['cluster', 'nebula', 'vs'], tab, setTab);
  const counts = useMemo(() => ({ open: boxCount('open'), globular: boxCount('globular') }), []);

  const chooseC = (m) => {
    setCmode(m);
    p.mark(`m2.${m}`);
  };
  const chooseN = (k) => {
    setNeb(k);
    if (k !== 'all') p.mark(`m2.neb.${k}`);
    else ['emission', 'reflection', 'dark'].forEach((x) => p.mark(`m2.neb.${x}`));
  };
  const dragged = useCallback(() => p.mark('m2.drag'), [p]);
  // 처음 화면에 들어오면 산개 성단을 본 것으로 기록
  const { mark } = p;
  useEffect(() => mark('m2.open'), [mark]);

  const C = CLUSTERS[obj[cmode === 'both' ? 'open' : cmode]];
  const lyFor = (t) => (cmode === 'both' && same ? 150 : t === 'open' ? 60 : 150);

  let stage;
  if (tab === 'cluster') {
    stage = (
      <>
        {subtabs || <SubTabs tabs={TABS} value={tab} onChange={setTab} />}
        {cmode !== 'both' ? (
          <>
            <ClusterCanvas type={cmode} lyAcross={lyFor(cmode)} showBox={box} label={cmode === 'open' ? '산개 성단 모형' : '구상 성단 모형'} onDrag={dragged} />
            <div style={{ position: 'absolute', right: '.9rem', top: '4.4rem', width: 'min(36%, 22rem)', aspectRatio: '4 / 3', zIndex: 5 }}>
              <PhotoOf k={C.photo} tag={C.name} style={{ width: "100%", height: "100%" }} />
            </div>
          </>
        ) : (
          <div className="fill" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--line)' }}>
            <div style={{ position: 'relative' }}>
              <ClusterCanvas type="open" lyAcross={lyFor('open')} showBox={box} label="산개 성단" onDrag={dragged} />
            </div>
            <div style={{ position: 'relative' }}>
              <ClusterCanvas type="globular" lyAcross={lyFor('globular')} showBox={box} label="구상 성단" onDrag={dragged} />
            </div>
          </div>
        )}
        <ScaleNote>별의 수를 줄여서 그렸고, 별 점의 크기는 밝기를 나타내요. 끌어서 돌려 보세요.</ScaleNote>
        <div className="dock">
          <button type="button" className={`btn ${cmode === 'open' ? 'on' : ''}`} onClick={() => chooseC('open')}>
            산개 성단
          </button>
          <button type="button" className={`btn ${cmode === 'globular' ? 'on' : ''}`} onClick={() => chooseC('globular')}>
            구상 성단
          </button>
          <button type="button" className={`btn ${cmode === 'both' ? 'on' : ''}`} onClick={() => { chooseC('both'); p.mark('m2.compare'); p.mark('m2.open'); p.mark('m2.globular'); }}>
            나란히 비교
          </button>
          <span className="sep" />
          <button type="button" className={`btn ${box ? 'on' : ''}`} aria-pressed={box} onClick={() => { setBox(!box); p.mark('m2.box'); }}>
            밀도 상자
          </button>
        </div>
      </>
    );
  } else if (tab === 'nebula') {
    const keys = neb === 'all' ? ['emission', 'reflection', 'dark'] : [neb];
    stage = (
      <>
        {subtabs || <SubTabs tabs={TABS} value={tab} onChange={setTab} />}
        <div className={`neb-grid ${keys.length > 1 ? 'multi' : 'single'}`} style={{ '--n': keys.length }}>
          {keys.map((k) => {
            const N = NEBULAE[k];
            return (
              <div key={k} className="neb-col">
                <PhotoOf k={N.photo} tag={`${N.name} · ${N.example}`} style={{ minHeight: 0 }} fit={keys.length > 1 ? 'cover' : 'contain'} />
                {keys.length > 1 && (
                  <div className="neb-title" style={{ textAlign: 'center', fontWeight: 750, color: N.color, fontSize: '1.05rem' }}>
                    {N.name}
                    <div style={{ fontSize: '.8rem', color: 'var(--ink-2)', fontWeight: 500 }}>{N.facts[0][1]} · {N.facts[1][1]}</div>
                  </div>
                )}
                <div style={{ minHeight: 0, borderRadius: '.9rem', border: '1px solid var(--line)', background: 'rgba(3,8,26,.6)', padding: '.3rem' }}>
                  <NebulaDiagram kind={N.diagram} compact={keys.length > 1} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="dock">
          {Object.entries(NEBULAE).map(([k, N]) => (
            <button key={k} type="button" className={`btn ${neb === k ? 'on' : ''}`} onClick={() => chooseN(k)}>
              <span style={{ width: '.7rem', height: '.7rem', borderRadius: '50%', background: N.color, display: 'inline-block' }} />
              {N.name}
            </button>
          ))}
          <span className="sep" />
          <button type="button" className={`btn ${neb === 'all' ? 'on' : ''}`} onClick={() => chooseN('all')}>
            한눈에 비교
          </button>
        </div>
      </>
    );
  } else {
    stage = (
      <>
        {subtabs || <SubTabs tabs={TABS} value={tab} onChange={setTab} />}
        <div className="fill" style={{ padding: '4.2rem .9rem .9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) minmax(0,1fr)', gap: '.5rem', minHeight: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--c-open)' }}>
              성단 = <span style={{ color: 'var(--ink)' }}>별</span>들의 집단
            </div>
            <PhotoOf k="pleiades" tag="산개 성단: 좀생이성단" style={{ minHeight: 0 }} />
            <PhotoOf k="m80" tag="구상 성단: NGC 6093" style={{ minHeight: 0 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) minmax(0,1fr)', gap: '.5rem', minHeight: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--c-emission)' }}>
              성운 = <span style={{ color: 'var(--ink)' }}>기체와 먼지</span>의 구름
            </div>
            <PhotoOf k="rosette" tag="방출 성운: 장미성운" style={{ minHeight: 0 }} />
            <PhotoOf k="horsehead" tag="암흑 성운: 말머리성운" style={{ minHeight: 0 }} />
          </div>
        </div>
      </>
    );
  }

  let panel;
  if (tab === 'cluster') {
    const both = cmode === 'both';
    panel = (
      <>
        <p>
          우리은하에는 많은 수의 별이 좁은 공간에 모여 집단을 이루는 <T k="성단">성단</T>이 있어요. 성단에는 수십~수만 개의 별들이 일정한 모양 없이 모여 있는 <b>산개 성단</b>과, 수만~수십만 개의 별들이 빽빽하게 모여서 공 모양을 이루는 <b>구상 성단</b>이 있어요.
        </p>
        {!both && (
          <>
            <Seg
              label="대표 천체"
              value={obj[cmode]}
              onChange={(v) => setObj({ ...obj, [cmode]: v })}
              options={Object.entries(CLUSTERS)
                .filter(([, c]) => c.type === cmode)
                .map(([k, c]) => ({ value: k, label: k === 'm13' ? 'M13' : c.name }))}
            />
            <h2 style={{ color: cmode === 'open' ? 'var(--c-open)' : 'var(--c-gc)' }}>
              {C.name} <span className="note">({C.alt})</span>
            </h2>
            <dl className="facts">
              {C.facts.map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
            <p dangerouslySetInnerHTML={{ __html: C.note }} />
          </>
        )}
        <table className="cmp" style={{ marginTop: '.8rem' }}>
          <thead>
            <tr>
              <th />
              <th style={{ color: 'var(--c-open)' }}>
                <T k="산개 성단">산개 성단</T>
              </th>
              <th style={{ color: 'var(--c-gc)' }}>
                <T k="구상 성단">구상 성단</T>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr><td>별의 수</td><td>수십~수만 개</td><td>수만~수십만 개</td></tr>
            <tr><td>모양</td><td>일정한 모양 없음</td><td>공 모양, 빽빽함</td></tr>
            <tr><td>별의 나이</td><td>젊은 별이 많음</td><td>늙은 별이 많음</td></tr>
            <tr><td>별의 색</td><td>파란색</td><td>붉은색</td></tr>
            <tr><td>분포</td><td>대부분 우리은하의 <b>나선팔</b></td><td>우리은하의 <b>중심부</b>와 은하 원반을 둘러싼 <b>구형의 공간</b></td></tr>
          </tbody>
        </table>
        {box && (
          <div className="card">
            <h3>밀도 상자 (한 변 10광년 정육면체, 성단 중심)</h3>
            <p>
              산개 성단: 약 <b>{counts.open.toLocaleString('ko-KR')}</b>개 · 구상 성단: 약 <b>{counts.globular.toLocaleString('ko-KR')}</b>개
            </p>
            <p className="note">실제 별 수(산개 약 1천 개, 구상 약 30만 개)로 모형에서 어림한 값이에요. 태양 주변의 같은 크기 상자에는 별이 1개 있을까 말까 해요.</p>
          </div>
        )}
        {both && (
          <label className="check">
            <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} />
            두 성단을 같은 축척으로 보기
          </label>
        )}
        <Mission
          id="m2a"
          title="확인 문제 ⑤-1"
          question="산개 성단과 구상 성단 중, 별들이 더 조밀하게(빽빽하게) 모여 있는 것은 무엇일까요?"
          requires={[
            { key: 'm2.open', label: '산개 성단 모형 보기' },
            { key: 'm2.globular', label: '구상 성단 모형 보기' },
            { key: 'm2.compare', label: '‘나란히 비교’로 두 성단 비교하기' },
          ]}
          options={[
            { text: '산개 성단', hint: '‘나란히 비교’와 ‘밀도 상자’를 켜고, 같은 크기의 상자 안에 별이 몇 개 들어 있는지 비교해 보세요.' },
            { text: '구상 성단', correct: true },
            { text: '둘 다 비슷하다', hint: '밀도 상자 속 별의 수를 비교해 보세요. 차이가 아주 커요!' },
          ]}
          explain="구상 성단은 수만~수백만 개의 별이 공 모양으로 아주 빽빽하게 모여 있어요. 산개 성단은 별 수가 적고 느슨하게 흩어져 있어요."
          next={{ label: '다음: 성운 탐험', onClick: () => setTab('nebula') }}
        />
      </>
    );
  } else if (tab === 'nebula') {
    const N = neb === 'all' ? null : NEBULAE[neb];
    panel = (
      <>
        <p>
          별과 별 사이의 공간은 기체와 먼지들이 희박하게 퍼져 있는데, 이를 <T k="성간 물질">성간 물질</T>이라고 해요. 성간 물질이 모여 있어 구름처럼 보이는 천체를 <T k="성운">성운</T>이라고 해요. 성운은 주로 우리은하의 나선팔에 분포하며 방출 성운, 반사 성운, 암흑 성운이 있어요.
        </p>
        {N ? (
          <>
            <h2 style={{ color: N.color }}>
              <T k={N.name}>{N.name}</T> <span className="note">예: {N.example}</span>
            </h2>
            <dl className="facts">
              {N.facts.map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd style={{ fontSize: '.92rem' }}>{b}</dd>
                </div>
              ))}
            </dl>
            <ul>
              {N.lines.map((l, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: l }} />
              ))}
            </ul>
          </>
        ) : (
          <table className="cmp">
            <thead>
              <tr>
                <th />
                <th style={{ color: 'var(--c-emission)' }}>방출</th>
                <th style={{ color: 'var(--c-reflection)' }}>반사</th>
                <th style={{ color: 'var(--c-dark)' }}>암흑</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>빛</td><td>기체가 직접 냄</td><td>별빛을 반사</td><td>뒤쪽 빛을 가림</td></tr>
              <tr><td>색</td><td>붉은색</td><td>푸른색</td><td>검은 그림자</td></tr>
              <tr><td>예</td><td>오리온 대성운</td><td>플레이아데스 주변</td><td>말머리 성운</td></tr>
            </tbody>
          </table>
        )}
        <p className="note">재미있는 점: 오리온 대성운과 말머리 성운은 모두 오리온자리에 있어요. 말머리 뒤쪽의 붉은 빛은 방출 성운이에요!</p>
        <Mission
          id="m2b"
          title="확인 문제 ⑤-2"
          question="성단과 성운의 차이를 가장 바르게 설명한 것은 무엇일까요?"
          requires={[
            { key: 'm2.neb.emission', label: '방출 성운 살펴보기' },
            { key: 'm2.neb.reflection', label: '반사 성운 살펴보기' },
            { key: 'm2.neb.dark', label: '암흑 성운 살펴보기' },
          ]}
          options={[
            { text: '성단은 기체와 먼지의 구름이고, 성운은 별들의 집단이다.', hint: '거꾸로 되었어요. 성단 탐험에서 본 것이 무엇들의 모임이었는지 떠올려 보세요.' },
            { text: '성단은 별들의 집단이고, 성운은 주로 기체와 먼지로 이루어진 구름이다.', correct: true },
            { text: '둘 다 별들의 집단인데, 크기만 다르다.', hint: '성운의 원리 그림을 다시 보세요. 성운에서 빛을 내거나 반사하거나 가리는 것은 무엇이었나요?' },
            { text: '성운은 우리은하 밖에만 있다.', hint: '오리온 대성운은 약 1,300광년 거리로, 우리은하 안(오리온자리 팔)에 있어요.' },
          ]}
          explain="성단은 별들이 모인 집단이고, 성운은 기체와 먼지가 모인 구름이에요. 성운은 기체가 빛을 내거나(방출), 별빛을 반사하거나(반사), 뒤쪽 빛을 가려서(암흑) 보여요."
          next={{ label: '다음: 성단과 성운 한눈에 비교', onClick: () => setTab('vs') }}
        />
      </>
    );
  } else {
    panel = (
      <>
        <h2>헷갈리지 마세요!</h2>
        <table className="cmp">
          <thead>
            <tr>
              <th />
              <th style={{ color: 'var(--c-open)' }}>성단</th>
              <th style={{ color: 'var(--c-emission)' }}>성운</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>무엇이 모였나</td><td><b>별</b>들</td><td><b>기체와 먼지</b></td></tr>
            <tr><td>사진에서</td><td>밝은 점(별)이 무리 지음</td><td>뿌옇게 퍼진 구름 모양</td></tr>
            <tr><td>빛</td><td>별이 스스로 빛남</td><td>빛을 내거나·반사하거나·가림</td></tr>
            <tr><td>종류</td><td>산개 성단, 구상 성단</td><td>방출·반사·암흑 성운</td></tr>
          </tbody>
        </table>
        <div className="card">
          <h3>성단과 성운은 서로 관계가 있어요</h3>
          <p>
            성운의 기체와 먼지가 중력으로 뭉치면 <b>새로운 별</b>이 태어나요. 한 성운에서 많은 별이 함께 태어나면 <b>산개 성단</b>이 돼요. 그래서 산개 성단의 별은 젊고, 성운이 많은 나선팔에 주로 있어요.
          </p>
        </div>
        <div className="card">
          <h3>은하 속 어디에 있을까?</h3>
          <p>
            산개 성단·성운 → 주로 은하 <b>원반</b>(나선팔) / 구상 성단 → 주로 은하 <b>헤일로</b>
          </p>
          <button type="button" className="btn outline" onClick={() => goTo('shape', '3d')}>
            우리은하의 모양과 크기에서 원반과 헤일로 다시 보기
          </button>
        </div>
        <button type="button" className="btn primary next-link" onClick={() => goTo('check')}>
          다음: 스스로 확인하기 →
        </button>
      </>
    );
  }

  return <ModuleShell override={shell} no={meta.no} title={meta.title} goal="성단과 성운의 종류 및 특징을 이해하고 차이를 설명할 수 있다." onReset={onReset} stage={stage} panel={panel} />;
}
