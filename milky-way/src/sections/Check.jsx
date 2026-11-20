import { useState } from 'react';
import { ModuleShell } from '../components/ui.jsx';
import { useProgress } from '../store.jsx';
import Galaxy3D from '../modules/m1/Galaxy3D.jsx';

function Choice({ id, no, before, after, options, answer, explain }) {
  const p = useProgress();
  const [pick, setPick] = useState(null);
  const solved = !!p.solved[id];
  const choose = (o) => {
    setPick(o);
    if (o === answer) p.solve(id);
  };
  return (
    <div className="ck-q">
      <p className="ck-text">
        <b className="ck-no">{no}</b> {before}
        <span className="ck-blank">
          {options.map((o, i) => (
            <span key={o}>
              {i > 0 && ', '}
              <button
                type="button"
                className={`ck-opt ${pick === o || (solved && o === answer) ? (o === answer ? 'right' : 'wrong') : ''}`}
                onClick={() => choose(o)}
                disabled={solved}
              >
                {o}
              </button>
            </span>
          ))}
        </span>
        {after}
      </p>
      {pick && pick !== answer && !solved && <div className="feedback hint">다시 생각해 보세요. 우리은하를 옆에서 본 그림을 떠올려 보세요.</div>}
      {solved && <div className="feedback good">정답! {explain}</div>}
    </div>
  );
}

function Blank({ id, no, before, after, answers, hint, explain, width = '6rem', placeholder }) {
  const p = useProgress();
  const [v, setV] = useState('');
  const [tried, setTried] = useState(false);
  const solved = !!p.solved[id];
  const check = (e) => {
    e.preventDefault();
    setTried(true);
    const norm = v.replace(/\s/g, '');
    if (answers.some((a) => norm === a.replace(/\s/g, ''))) p.solve(id);
  };
  return (
    <form className="ck-q" onSubmit={check}>
      <p className="ck-text">
        <b className="ck-no">{no}</b> {before}
        <input className="ck-input" style={{ width }} value={solved ? answers[0] : v} onChange={(e) => { setV(e.target.value); setTried(false); }} disabled={solved} aria-label="빈칸" placeholder={placeholder} />
        {after}
        {!solved && (
          <button type="submit" className="reset-btn" style={{ marginLeft: '.4rem' }}>
            확인
          </button>
        )}
      </p>
      {tried && !solved && <div className="feedback hint">{hint}</div>}
      {solved && <div className="feedback good">정답! {explain}</div>}
    </form>
  );
}

const KEYWORDS = [
  { k: '산개 성단·성운의 위치', re: /(나선팔|원반)/, tip: '산개 성단과 성운(반사 성운)은 어디에 분포하나요?' },
  { k: '구상 성단의 위치', re: /(헤일로|중심부|구형|둘러싼)/, tip: '구상 성단은 어디에 많이 분포하나요?' },
  { k: '성운을 이루는 물질', re: /(성간\s*물질|기체|먼지|가스)/, tip: '성운은 무엇으로 이루어져 있나요?' },
];

function Essay() {
  const p = useProgress();
  const [text, setText] = useState('');
  const [show, setShow] = useState(false);
  const hits = KEYWORDS.map((w) => w.re.test(text));
  return (
    <div className="ck-q">
      <p className="ck-text">
        <b className="ck-no">3</b> <span className="pill">사고력</span> 산개 성단은 반사 성운과 함께 관측되지만, 구상 성단은 반사 성운과 함께 관측되지 않는 까닭을 우리은하 구성 천체인 성단과 성운의 분포로 설명해 보자.
      </p>
      <textarea className="ck-area" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="여기에 내 생각을 써 보세요." aria-label="서술형 답" />
      <div className="ck-keys">
        {KEYWORDS.map((w, i) => (
          <span key={w.k} className={`ck-key ${hits[i] ? 'on' : ''}`} title={w.tip}>
            {hits[i] ? '✓' : '○'} {w.k}
          </span>
        ))}
      </div>
      {!hits.every(Boolean) && text.length > 8 && (
        <p className="note">빠진 내용 힌트: {KEYWORDS.filter((_, i) => !hits[i]).map((w) => w.tip).join(' ')}</p>
      )}
      <button
        type="button"
        className="btn outline"
        disabled={text.trim().length < 10}
        onClick={() => {
          setShow(true);
          p.solve('c3');
        }}
      >
        {text.trim().length < 10 ? '내 생각을 먼저 써 보세요' : '예시 답안과 비교하기'}
      </button>
      {show && (
        <div className="feedback good">
          <b>예시 답안</b> 산개 성단과 성운은 주로 우리은하의 <b>나선팔(원반)</b>에 분포하고, 이곳에는 기체와 먼지 같은 <b>성간 물질</b>이 많아서 산개 성단의 별빛을 반사하는 반사 성운이 함께 관측된다. 구상 성단은 주로 우리은하의 <b>중심부와 은하 원반을 둘러싼 구형의 공간(헤일로)</b>에 분포하는데, 이곳에는 성간 물질이 거의 없어서 반사 성운이 함께 관측되지 않는다.
        </div>
      )}
    </div>
  );
}

export default function Check({ shell, goTo }) {
  const p = useProgress();
  const ids = ['c1', 'c2', 'c3', 'c4'];
  const done = ids.filter((i) => p.solved[i]).length;
  const stage = (
    <>
      <Galaxy3D halo labels selected={null} measure onPick={() => {}} onAction={() => {}} onZoom={() => {}} />
      <div className="ck-hint">돌려 보며 문제를 풀어 보세요</div>
    </>
  );
  const panel = (
    <>
      <div className="ck-box">
        <div className="ck-head">스스로 확인하기 <span>{done}/4</span></div>
        <Choice
          id="c1"
          no="1"
          before="우리은하를 옆에서 보면 중심부가 ("
          after=") 원반 모양이다."
          options={['볼록한', '납작한']}
          answer="볼록한"
          explain="옆에서 보면 중심부(팽대부)가 볼록한 원반 모양이에요."
        />
        <Blank
          id="c2"
          no="2"
          before="수만~수십만 개의 별들이 공 모양으로 빽빽하게 모여 있는 것을 ("
          after=") 성단이라고 한다."
          answers={['구상']}
          width="4.5rem"
          hint="‘공 모양(구 모양)’을 뜻하는 말이 들어가요. 두 글자예요."
          explain="구상 성단은 붉은색의 늙은 별로 구성되며, 우리은하의 중심부와 헤일로에 많이 분포해요."
        />
        <Essay />
      </div>
      <div className="ck-box must">
        <div className="ck-head">이것만은 꼭</div>
        <Blank
          id="c4"
          no="✔"
          before="우리은하를 위에서 보면 중심부에는 막대 구조가 있고 막대 끝에 소용돌이 모양의 "
          after="팔이 있다."
          answers={['나선']}
          width="4rem"
          placeholder="ㄴㅅ"
          hint="초성 ㄴㅅ — 소용돌이처럼 휘어진 모양을 뜻하는 말이에요."
          explain="우리은하는 막대 구조와 나선팔을 가진 막대나선은하예요."
        />
      </div>
      <div className="card">
        <h3>단원 정리</h3>
        <ul>
          <li>우리은하는 위에서 보면 중심부에 막대 구조, 막대 끝에 나선팔이 있고, 옆에서 보면 중심부가 볼록한 원반 모양이다.</li>
          <li>우리은하의 지름은 약 30000 pc이고, 태양계는 우리은하 중심에서 약 8500 pc 떨어진 나선팔의 원반 면에 있다.</li>
          <li>별들이 대부분 원반 면에 분포하므로 은하수가 띠 모양으로 보이고, 북반구 여름철에는 은하 중심 방향을 보게 되어 은하수가 겨울철보다 두껍게 보인다.</li>
          <li>성단: 산개 성단(나선팔, 파란색 젊은 별), 구상 성단(중심부·헤일로, 붉은색 늙은 별) / 성운: 방출·반사·암흑 성운(주로 나선팔)</li>
        </ul>
        <button type="button" className="btn outline" onClick={() => goTo('home')}>
          처음 화면에서 이 단원 목표 점검하기
        </button>
      </div>
    </>
  );
  return <ModuleShell override={shell} stage={stage} panel={panel} onReset={() => {}} />;
}
