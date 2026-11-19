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
    type: 'open', name: '플레이아데스 성단', alt: 'M45 · 좀생이별', photo: 'pleiades',
    facts: [['별자리', '황소자리'], ['거리', '약 440광년'], ['나이', '약 1억 년'], ['별의 수', '1,000개 이상']],
    note: '맨눈으로도 별 6~7개가 모여 보여요. 우리 조상들은 ‘좀생이별’이라고 불렀어요. 사진 속 푸른 안개는 성단이 지나가는 먼지 구름이 별빛을 반사한 <b>반사 성운</b>이에요.',
  },
  hyades: {
    type: 'open', name: '히아데스 성단', alt: 'Melotte 25', photo: 'hyades',
    facts: [['별자리', '황소자리'], ['거리', '약 150광년'], ['나이', '약 6억 년'], ['별의 수', '수백 개']],
    note: '가장 가까운 산개 성단 중 하나로, 황소의 얼굴처럼 V자 모양으로 별이 늘어서 있어요. 밝은 주황색 별 알데바란은 성단보다 훨씬 가까이 있는 별로, 성단의 구성원이 아니에요.',
  },
  m13: {
    type: 'globular', name: '헤르쿨레스자리 구상 성단', alt: 'M13 · 헤라클레스 구상 성단', photo: 'm13',
    facts: [['별자리', '헤르쿨레스자리'], ['거리', '약 2만 2천 광년'], ['나이', '약 120억 년'], ['별의 수', '수십만 개']],
    note: '지름 약 145광년 안에 수십만 개의 별이 공 모양으로 빽빽하게 모여 있어요. 여름철 밤하늘에서 망원경으로 볼 수 있는 대표적인 구상 성단이에요.',
  },
  omega: {
    type: 'globular', name: '오메가 센타우리', alt: 'NGC 5139', photo: 'omega',
    facts: [['별자리', '센타우루스자리'], ['거리', '약 1만 7천 광년'], ['나이', '약 120억 년'], ['별의 수', '약 1,000만 개']],
    note: '우리 은하에서 가장 크고 밝은 구상 성단이에요. 남쪽 하늘에 있어서 우리나라에서는 남쪽 지평선에 아주 낮게 떠 보기 어려워요.',
  },
};

export const NEBULAE = {
  emission: {
    name: '방출 성운', color: 'var(--c-emission)', example: '오리온 대성운 (M42)', photo: 'orion', diagram: 'emission',
    facts: [['빛의 출발점', '성운 속 기체 자신'], ['색', '주로 붉은색'], ['거리', '약 1,300광년'], ['특징', '별이 태어나는 곳']],
    lines: [
      '성운 속이나 근처에 있는 <b>뜨겁고 젊은 별</b>이 강한 에너지(자외선)를 내보내요.',
      '에너지를 받은 <b>기체(주로 수소)가 스스로 빛</b>을 내요. 수소가 내는 빛 때문에 붉게 보여요.',
      '오리온 대성운 안에서는 지금도 새로운 별이 태어나고 있어요.',
    ],
  },
  reflection: {
    name: '반사 성운', color: 'var(--c-reflection)', example: '플레이아데스 주변의 반사 성운 (메로페 성운)', photo: 'merope', diagram: 'reflection',
    facts: [['빛의 출발점', '근처 별의 빛'], ['색', '주로 푸른색'], ['거리', '약 440광년'], ['특징', '먼지가 별빛을 반사']],
    lines: [
      '성운의 <b>먼지</b>는 스스로 빛을 내지 못해요.',
      '근처 밝은 별의 빛을 먼지가 <b>반사(흩뜨려)</b>해서 보여요.',
      '파란빛이 더 잘 흩어지기 때문에 푸르게 보여요. (낮 하늘이 파란 까닭과 비슷해요)',
    ],
  },
  dark: {
    name: '암흑 성운', color: 'var(--c-dark)', example: '말머리 성운 (오리온자리)', photo: 'horsehead', diagram: 'dark',
    facts: [['빛의 출발점', '없음(뒤쪽 빛을 가림)'], ['색', '검은 그림자'], ['거리', '약 1,400광년'], ['특징', '짙은 가스와 먼지']],
    lines: [
      '짙은 기체와 <b>먼지 구름</b>이 뒤쪽에서 오는 빛을 <b>가려서</b> 어둡게 보여요.',
      '말머리 성운은 뒤쪽의 붉은 방출 성운(IC 434) 앞에 있어서, 말 머리 모양의 검은 그림자로 보여요.',
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

export default function Module2({ meta, onReset, goTo }) {
  const p = useProgress();
  const [tab, setTab] = useState('cluster');
  const [cmode, setCmode] = useState('open'); // open | globular | both
  const [obj, setObj] = useState({ open: 'pleiades', globular: 'm13' });
  const [box, setBox] = useState(false);
  const [same, setSame] = useState(true);
  const [neb, setNeb] = useState('emission');
  useArrowSteps(['cluster', 'nebula', 'vs'], tab, setTab);
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
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
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
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
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
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
        <div className="fill" style={{ padding: '4.2rem .9rem .9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) minmax(0,1fr)', gap: '.5rem', minHeight: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--c-open)' }}>
              성단 = <span style={{ color: 'var(--ink)' }}>별</span>들의 집단
            </div>
            <PhotoOf k="pleiades" tag="산개 성단: 플레이아데스" style={{ minHeight: 0 }} />
            <PhotoOf k="m13" tag="구상 성단: M13" style={{ minHeight: 0 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) minmax(0,1fr)', gap: '.5rem', minHeight: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--c-emission)' }}>
              성운 = <span style={{ color: 'var(--ink)' }}>기체와 먼지</span>의 구름
            </div>
            <PhotoOf k="orion" tag="방출 성운: 오리온 대성운" style={{ minHeight: 0 }} />
            <PhotoOf k="horsehead" tag="암흑 성운: 말머리 성운" style={{ minHeight: 0 }} />
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
          <T k="성단">성단</T>은 많은 <b>별</b>이 무리 지어 모여 있는 천체예요. 별이 모인 모양과 개수에 따라 두 가지로 나눠요.
        </p>
        {!both && (
          <>
            <Seg
              label="대표 천체"
              value={obj[cmode]}
              onChange={(v) => setObj({ ...obj, [cmode]: v })}
              options={Object.entries(CLUSTERS)
                .filter(([, c]) => c.type === cmode)
                .map(([k, c]) => ({ value: k, label: c.name.replace('헤르쿨레스자리 ', '').replace('구상 성단', 'M13') }))}
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
            <tr><td>별의 수</td><td>수십~수천 개</td><td>수만~수백만 개</td></tr>
            <tr><td>모양</td><td>불규칙, 느슨함</td><td>공 모양, 빽빽함</td></tr>
            <tr><td>별의 나이</td><td>젊은 별이 많음</td><td>늙은 별이 많음</td></tr>
            <tr><td>별의 색</td><td>파란색 별이 눈에 띔</td><td>붉은색·노란색 별이 많음</td></tr>
            <tr><td>위치</td><td>은하 <b>원반</b>(나선팔)</td><td>은하 <b>헤일로</b></td></tr>
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
          no="2"
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
          <T k="성운">성운</T>은 우주 공간의 <b>기체와 먼지</b>가 구름처럼 모인 천체예요. 빛이 어디에서 오는지에 따라 세 가지로 나눠요.
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
          no="2-2"
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
            { text: '성운은 우리 은하 밖에만 있다.', hint: '오리온 대성운은 약 1,300광년 거리로, 우리 은하 안(오리온자리 팔)에 있어요.' },
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
          <button type="button" className="btn outline" onClick={() => goTo(1)}>
            탐험 1에서 원반과 헤일로 다시 보기
          </button>
        </div>
        <button type="button" className="btn primary next-link" onClick={() => goTo(3)}>
          다음 탐험: 태양계의 위치 →
        </button>
      </>
    );
  }

  return <ModuleShell no={meta.no} title={meta.title} goal="성단과 성운의 종류 및 특징을 이해하고 차이를 설명할 수 있다." onReset={onReset} stage={stage} panel={panel} />;
}
