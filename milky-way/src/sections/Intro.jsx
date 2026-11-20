import { useEffect, useMemo, useRef, useState } from 'react';
import SkyView from '../modules/m4/SkyView.jsx';
import { Mission, ModuleShell, ScaleNote, T, useCanvasSize } from '../components/ui.jsx';
import { kstDate } from '../lib/astro.js';
import { loadPanorama, panoramaLuminance } from '../lib/skyTexture.js';
import { rng } from '../lib/galaxy.js';
import { useProgress } from '../store.jsx';

// 견우성(알타이르)·직녀성(베가) 표시
const PAIR = [
  { id: 'vega', ra: 279.23, dec: 38.78, label: '직녀성', sub: '(베가)', color: '#ffe9a8', r: 11 },
  { id: 'altair', ra: 297.7, dec: 8.87, label: '견우성', sub: '(알타이르)', color: '#ffe9a8', r: 11 },
];

// 갈릴레이 망원경으로 본 은하수: 방패자리 별 구름(은경 약 27°) 부근
const L0 = 27;
const B0 = -2.5;

function Telescope({ mag }) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const size = useCanvasSize(wrap);
  const [pano, setPano] = useState(null);
  const [lum, setLum] = useState(null);
  useEffect(() => {
    let alive = true;
    loadPanorama().then((r) => alive && setPano(r));
    panoramaLuminance().then((l) => alive && setLum(l));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const c = cv.current;
    const { w, h, dpr } = size;
    if (!w || !pano) return;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const D = Math.min(w, h) * 0.86; // 접안렌즈 시야(지름, 픽셀)
    const cx = w / 2;
    const cy = h / 2;
    const fov = 40 / mag; // 시야(도)
    const pxPerDeg = D / fov;
    g.save();
    g.beginPath();
    g.arc(cx, cy, D / 2, 0, Math.PI * 2);
    g.clip();
    // 1) 맨눈에 보이는 뿌연 빛(배율이 높을수록 별로 나뉘어 흐려짐)
    const im = pano.image;
    const W = im.width;
    const H = im.height;
    const sw = (fov / 360) * W;
    const sx = (0.5 - L0 / 360) * W - sw / 2;
    const sy = H / 2 - (B0 / 180) * H - sw / 2;
    g.filter = `blur(${Math.max(1, 6 - mag * 0.2)}px)`;
    g.globalAlpha = 1 / (1 + Math.pow(mag / 5, 1.3));
    g.drawImage(im, sx, sy, sw, sw, cx - D / 2, cy - D / 2, D, D);
    g.filter = 'none';
    g.globalAlpha = 1;
    // 2) 망원경으로 나뉘어 보이는 수많은 별(밝은 은하수일수록 별이 많음)
    if (lum) {
      const cell = 0.5; // 도
      const visFrac = Math.min(1, Math.pow(mag / 20, 1.6)); // 배율이 클수록 어두운 별까지
      const i0 = Math.floor((L0 - fov / 2) / cell) - 1;
      const i1 = Math.ceil((L0 + fov / 2) / cell) + 1;
      const j0 = Math.floor((B0 - fov / 2) / cell) - 1;
      const j1 = Math.ceil((B0 + fov / 2) / cell) + 1;
      g.globalCompositeOperation = 'lighter';
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const lc = (i + 0.5) * cell;
          const bc = (j + 0.5) * cell;
          const li = Math.floor((((180 - lc) % 360) + 360) % 360);
          const bi = Math.max(0, Math.min(179, Math.floor(90 - bc)));
          const bright = lum.lum[bi * 360 + li] || 0;
          const nMax = Math.round(30 + Math.min(1, bright * 12) * 900);
          const n = Math.round(nMax * (0.004 + visFrac));
          const R = rng((i * 92821) ^ (j * 68917) ^ 7);
          for (let s = 0; s < n; s++) {
            const l = (i + R()) * cell;
            const b = (j + R()) * cell;
            const x = cx - (l - L0) * pxPerDeg;
            const y = cy - (b - B0) * pxPerDeg;
            const m = Math.pow(R(), 6);
            const r = 0.5 + m * 2.4 * Math.min(1.6, 0.6 + mag / 20);
            const t = R();
            const base = t < 0.25 ? '255,215,170' : t < 0.55 ? '205,220,255' : '255,255,255';
            g.fillStyle = `rgba(${base},${(0.35 + m * 0.65).toFixed(2)})`;
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    // 접안렌즈 테두리
    g.strokeStyle = 'rgba(200,215,255,.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, D / 2, 0, Math.PI * 2);
    g.stroke();
    g.font = '700 15px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillStyle = '#e8eeff';
    g.textAlign = 'left';
    g.fillText(mag <= 1.05 ? '맨눈으로 본 은하수' : `망원경 배율 약 ${Math.round(mag)}배`, 14, 148);
    g.fillStyle = '#aebbd8';
    g.font = '500 12.5px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillText(`보이는 하늘의 폭: 약 ${fov >= 10 ? Math.round(fov) : fov.toFixed(1)}°`, 14, 168);
  }, [size, pano, lum, mag]);
  return (
    <div ref={wrap} className="fill">
      <canvas ref={cv} className="fill" aria-label="망원경으로 확대한 은하수" />
    </div>
  );
}

export default function Intro({ shell, subtabs, tab, goTo }) {
  const p = useProgress();
  const { mark } = p;
  const [mag, setMag] = useState(1);
  const date = useMemo(() => kstDate(2026, 8, 19, 22), []);
  useEffect(() => {
    if (mag >= 15) mark('intro.zoom');
  }, [mag, mark]);
  useEffect(() => {
    if (tab === 'sky') mark('intro.sky');
  }, [tab, mark]);

  const stage =
    tab === 'sky' ? (
      <>
        {subtabs}
        <SkyView date={date} mode="dome" lines={false} names={false} galEq={false} light={0} twilight={false} marks={PAIR} titleY={78} title="여름밤 하늘(서울, 8월 중순 밤 10시)" sub="직녀성과 견우성 사이를 흐르는 은하수" accent="#ffe9a8" />
        <div className="intro-bubble" style={{ left: '1rem', bottom: '5.4rem' }}>
          고구려 시대의 벽화인데, 은하수를 사이에 두고 견우와 직녀의 모습이 그려져 있어.
        </div>
        <div className="intro-bubble right" style={{ right: '1rem', bottom: '5.4rem' }}>
          와, 옛날에도 직녀성과 견우성 사이에 있는 은하수를 볼 수 있었구나!
        </div>
      </>
    ) : (
      <>
        {subtabs}
        <Telescope mag={mag} />
        <div className="dock">
          <span className="btn" style={{ cursor: 'default' }}>배율</span>
          <input type="range" min="0" max="100" value={Math.round((Math.log(mag) / Math.log(30)) * 100)} onChange={(e) => setMag(Math.exp((Number(e.target.value) / 100) * Math.log(30)))} aria-label="망원경 배율" style={{ width: '12rem' }} />
          <button type="button" className={`btn ${mag < 1.1 ? 'on' : ''}`} onClick={() => setMag(1)}>
            맨눈
          </button>
          <button type="button" className={`btn ${Math.abs(mag - 20) < 1 ? 'on' : ''}`} onClick={() => setMag(20)}>
            갈릴레이 망원경(약 20배)
          </button>
        </div>
        <ScaleNote>은하수 사진(ESO) 위에, 망원경으로 나뉘어 보이는 별들을 은하수 밝기에 맞춰 그렸어요.</ScaleNote>
      </>
    );

  const panel =
    tab === 'sky' ? (
      <>
        <div className="tb-box">
          <p>
            <b>이 단원에서 나는</b>
          </p>
          <ul style={{ margin: '.2rem 0' }}>
            <li>우리은하의 구조와 크기를 설명할 수 있다.</li>
            <li>우리은하를 구성하는 성단과 성운의 특징을 비교할 수 있다.</li>
          </ul>
        </div>
        <p>
          고구려 시대의 무덤 벽화(덕흥리 고분, 408년)에는 <b>은하수를 사이에 두고 견우와 직녀</b>가 그려져 있어요. 옛사람들도 여름밤에 직녀성과 견우성 사이를 흐르는 <T k="은하수">은하수</T>를 보았던 거예요.
        </p>
        <p>
          화면은 지금 서울의 여름밤 하늘이에요. 노란 동그라미의 <b>직녀성</b>과 <b>견우성</b> 사이를 지나는 뿌연 빛의 띠를 찾아보세요.
        </p>
        <div className="card">
          <h3>생각해 보기</h3>
          <p style={{ fontSize: '1.02rem', color: 'var(--ink)' }}>
            <b>은하수를 이루고 있는 천체들은 무엇일까?</b>
          </p>
          <button type="button" className="btn primary" onClick={() => goTo('intro', 'scope')}>
            망원경으로 은하수 확대해 보기 →
          </button>
        </div>
      </>
    ) : (
      <>
        <h2 style={{ marginTop: '.6rem' }}>우리은하의 모양과 크기는 어떠할까?</h2>
        <p>
          배율 막대를 오른쪽으로 끌어 은하수를 망원경으로 확대해 보세요. 맨눈으로는 뿌연 빛의 띠였던 은하수가 어떻게 보이나요?
        </p>
        <div className="card">
          <p>
            <b>갈릴레이</b>(1564~1642)는 망원경을 이용하여 최초로 천체를 관측했어요. 갈릴레이는 천체 망원경으로 <b>은하수가 수많은 별의 집단</b>이라는 것을 관측했고, 그 후 과학자들은 <b>은하수가 우리은하의 일부</b>임을 알아냈어요.
          </p>
        </div>
        <Mission
          id="i1"
          title="생각해 보기"
          question="은하수를 이루고 있는 천체들은 무엇일까요?"
          requires={[{ key: 'intro.zoom', label: '망원경 배율을 15배 이상으로 올려 은하수 관찰하기' }]}
          options={[
            { text: '지구 대기 속의 구름과 수증기', hint: '구름이라면 망원경으로 확대해도 뿌옇게 보여야 해요. 확대했을 때 무엇이 보였나요?' },
            { text: '수많은 별(과 별 사이의 기체·먼지)', correct: true },
            { text: '달빛이 반사된 빛', hint: '은하수는 달이 없는 어두운 밤에 더 잘 보여요. 확대한 화면을 다시 보세요.' },
          ]}
          explain="은하수는 너무 멀어서 하나하나 구별되지 않는 수많은 별빛이 모인 것이에요. 우리은하에는 별 말고도 별의 집단인 성단, 기체와 먼지로 된 성운도 있어요."
          next={{ label: '다음: 해보기 — 여름철과 겨울철의 은하수 비교하기', onClick: () => goTo('try') }}
        />
      </>
    );

  return <ModuleShell override={shell} stage={stage} panel={panel} onReset={() => setMag(1)} />;
}
