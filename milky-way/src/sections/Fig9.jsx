import { useEffect, useMemo, useRef, useState } from 'react';
import { Mission, ModuleShell, ScaleNote, T, useCanvasSize } from '../components/ui.jsx';
import { PanoCrop } from '../modules/m4/DirectionCompare.jsx';
import { R_SUN, makeGalaxyParticles } from '../lib/galaxy.js';
import { useProgress } from '../store.jsx';

// 교과서 그림 9: 우리은하를 옆에서 본 모습 — 태양계에서 A(은하 중심 쪽)와 B(바깥쪽)를 바라보기
const DIRS = {
  A: { l: 0, b: 0, title: 'A 방향(은하 중심 쪽)', color: '#ff8fb8', see: '은하 중심부(팽대부)와 원반의 별이 겹겹이 보여요. 은하수가 넓고 밝으며, 먼지 띠 때문에 복잡하게 보여요.' },
  B: { l: 180, b: 0, title: 'B 방향(은하 바깥쪽)', color: '#7fd0ff', see: '원반의 가장자리 쪽이라 별이 적어요. 은하수가 가늘고 희미하게 보여요.' },
  C: { l: 0, b: 62, title: '원반 위쪽(원반 바깥)', color: '#c9a2ff', see: '원반을 벗어난 방향이라 별이 드문드문 있을 뿐, 은하수(띠)가 보이지 않아요.' },
};

function SideView({ pick, setPick }) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const size = useCanvasSize(wrap);
  const P = useMemo(() => makeGalaxyParticles({ disk: 22000, arm: 16000, bulge: 9000, bar: 4000, halo: 2600, globular: 150, seed: 9 }), []);
  const hit = useRef({});
  useEffect(() => {
    const c = cv.current;
    const { w, h, dpr } = size;
    if (!w) return;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#02050f';
    g.fillRect(0, 0, w, h);
    // 은하 중심을 왼쪽, 태양계를 오른쪽에(교과서 그림처럼)
    const k = Math.min(w / 125, h / 70);
    const cx = w * 0.44;
    const cy = h * 0.52;
    const X = (y) => cx - y * k;
    const Y = (z) => cy - z * k * 1.0;
    g.globalCompositeOperation = 'lighter';
    const pos = P.position;
    const col = P.color;
    const sz = P.size;
    const grp = P.group;
    for (let i = 0; i < pos.length / 3; i++) {
      const x = X(pos[i * 3 + 1]);
      const y = Y(pos[i * 3 + 2]);
      if (x < -5 || x > w + 5 || y < -5 || y > h + 5) continue;
      const gg = grp[i];
      const s = gg === 5 ? 2.6 : Math.max(0.7, sz[i] * 0.55);
      const a = gg === 4 ? 0.35 : gg === 5 ? 0.9 : 0.16;
      g.fillStyle = `rgba(${Math.round(col[i * 3] * 255)},${Math.round(col[i * 3 + 1] * 255)},${Math.round(col[i * 3 + 2] * 255)},${a})`;
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    // 원반·팽대부 은은한 빛
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 9 * k);
    grd.addColorStop(0, 'rgba(255,225,170,.55)');
    grd.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = grd;
    g.fillRect(cx - 10 * k, cy - 10 * k, 20 * k, 20 * k);
    g.globalCompositeOperation = 'source-over';
    // 태양계와 화살표
    const sx = X(-R_SUN);
    const sy = Y(0);
    const arrow = (x2, y2, color, label, key, on) => {
      const ang = Math.atan2(y2 - sy, x2 - sx);
      g.strokeStyle = color;
      g.fillStyle = color;
      g.lineWidth = on ? 5 : 3;
      g.beginPath();
      g.moveTo(sx + Math.cos(ang) * 10, sy + Math.sin(ang) * 10);
      g.lineTo(x2, y2);
      g.stroke();
      g.beginPath();
      g.moveTo(x2 + Math.cos(ang) * 12, y2 + Math.sin(ang) * 12);
      g.lineTo(x2 + Math.cos(ang + 2.5) * 12, y2 + Math.sin(ang + 2.5) * 12);
      g.lineTo(x2 + Math.cos(ang - 2.5) * 12, y2 + Math.sin(ang - 2.5) * 12);
      g.fill();
      g.font = `800 ${on ? 26 : 22}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 5;
      g.strokeStyle = '#02050f';
      const lx = x2 + Math.cos(ang) * 30;
      const ly = y2 + Math.sin(ang) * 30;
      g.strokeText(label, lx, ly);
      g.fillText(label, lx, ly);
      hit.current[key] = { x: lx, y: ly, x2, y2 };
    };
    arrow(sx - 13 * k, sy, DIRS.A.color, 'A', 'A', pick === 'A');
    arrow(sx + 13 * k, sy, DIRS.B.color, 'B', 'B', pick === 'B');
    arrow(sx, sy - 18 * k, DIRS.C.color, '위', 'C', pick === 'C');
    g.fillStyle = '#ffe14d';
    g.shadowColor = '#ffe14d';
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(sx, sy, 6, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    const lbl = (t, x, y, c, s = 15, al = 'center') => {
      g.font = `700 ${s}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      g.textAlign = al;
      g.lineWidth = 4;
      g.strokeStyle = '#02050f';
      g.strokeText(t, x, y);
      g.fillStyle = c;
      g.fillText(t, x, y);
    };
    lbl('태양계', sx, sy + 26, '#ffe14d', 16);
    lbl('은하 중심', cx, cy + 9 * k, '#ffc46b', 14);
    lbl('그림 9 | 우리은하를 옆에서 본 모습', 14, h - 16, '#aebbd8', 13, 'left');
  }, [size, P, pick]);

  useEffect(() => {
    const el = cv.current;
    const click = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      let best = null;
      Object.entries(hit.current).forEach(([k2, v]) => {
        const d = Math.min(Math.hypot(v.x - x, v.y - y), Math.hypot(v.x2 - x, v.y2 - y));
        if (d < 45 && (!best || d < best.d)) best = { k: k2, d };
      });
      if (best) setPick(best.k);
    };
    el.addEventListener('click', click);
    return () => el.removeEventListener('click', click);
  }, [setPick]);

  return (
    <div ref={wrap} className="fill">
      <canvas ref={cv} className="fill" style={{ cursor: 'pointer' }} aria-label="우리은하를 옆에서 본 모습. A, B, 위 화살표를 누르면 그 방향의 하늘이 보여요" />
    </div>
  );
}

export default function Fig9({ shell, subtabs, goTo }) {
  const p = useProgress();
  const { mark } = p;
  const [pick, setPick] = useState(null);
  const choose = (k) => {
    setPick(k);
    mark(`fig9.${k}`);
  };
  const D = pick ? DIRS[pick] : null;
  const stage = (
    <>
      {subtabs}
      <SideView pick={pick} setPick={choose} />
      {D && (
        <div className="fig9-view" style={{ '--c': D.color }}>
          <div style={{ fontWeight: 800, color: D.color, marginBottom: '.3rem' }}>{D.title}을 바라본 하늘</div>
          <div style={{ height: '9.5rem' }}>
            <PanoCrop l0={D.l} b0={D.b} label="실제 은하수 사진" color={D.color} />
          </div>
          <p style={{ margin: '.4rem 0 0', fontSize: '.88rem', color: 'var(--ink-2)' }}>{D.see}</p>
        </div>
      )}
      <ScaleNote>우리은하 모형 그림이에요. 태양계의 점은 위치만 나타내요. 오른쪽 하늘 사진은 그 방향의 실제 은하수 사진(ESO)이에요.</ScaleNote>
      <div className="dock">
        {Object.entries(DIRS).map(([k, d]) => (
          <button key={k} type="button" className={`btn ${pick === k ? 'on' : ''}`} onClick={() => choose(k)}>
            <span style={{ color: d.color }}>●</span> {k === 'C' ? '원반 위쪽' : `${k} 방향`}
          </button>
        ))}
      </div>
    </>
  );
  const panel = (
    <>
      <p>
        그림 9는 우리은하를 옆에서 본 모습이에요. 태양계는 납작한 원반 안에 있어요. 화살표를 눌러 태양계에서 각 방향을 바라보면 하늘이 어떻게 보이는지 확인해 보세요.
      </p>
      <Mission
        id="t1"
        title="질문 1"
        question="은하수가 띠 모양으로 보이는 까닭을 그림 9를 참고하여 설명한 것으로 옳은 것은?"
        requires={[
          { key: 'fig9.A', label: 'A 방향 하늘 보기' },
          { key: 'fig9.B', label: 'B 방향 하늘 보기' },
          { key: 'fig9.C', label: '원반 위쪽 하늘 보기' },
        ]}
        options={[
          { text: '우리은하의 별들은 대부분 납작한 원반 면에 분포하고 태양계도 원반 안에 있어서, 원반 방향으로 수많은 별빛이 겹쳐 띠처럼 보이기 때문이다.', correct: true },
          { text: '은하수는 지구 대기의 구름이 띠 모양으로 늘어선 것이기 때문이다.', hint: '갈릴레이가 망원경으로 본 은하수는 무엇의 집단이었나요?' },
          { text: '우리은하는 공 모양이라 어느 방향에서나 똑같이 보이기 때문이다.', hint: '원반 위쪽을 바라본 하늘에도 띠가 보였나요? 우리은하를 옆에서 본 모양을 떠올려 보세요.' },
        ]}
        explain="우리은하의 별들은 대부분 원반 면에 분포해요. 태양계는 원반 안에 있으므로 원반 방향을 보면 별이 많이 겹쳐 띠 모양의 은하수로 보이고, 원반 바깥 방향에는 별이 적어 띠가 보이지 않아요."
      />
      <Mission
        id="t2"
        title="질문 2 · 협력적 소통"
        question="여름철의 은하수는 A와 B 중 어느 방향을 바라볼 때의 모습일까요? 까닭도 함께 생각해 모둠원에게 설명해 보세요."
        requires={[
          { key: 'fig9.A', label: 'A 방향 하늘 보기' },
          { key: 'fig9.B', label: 'B 방향 하늘 보기' },
        ]}
        options={[
          { text: 'A — 은하 중심 쪽이라 별과 성간 물질이 많아 은하수가 넓고 밝게 보이기 때문', correct: true },
          { text: 'B — 은하 바깥쪽이라 별이 적어 은하수가 가늘고 희미하게 보이기 때문', hint: '해보기 ①에서 여름철 은하수 사진은 넓고 밝았나요, 가늘고 희미했나요? 어느 방향 하늘과 닮았는지 비교해 보세요.' },
        ]}
        explain="북반구 여름철에는 지구가 공전하면서 밤에 우리은하의 중심 방향(A, 궁수자리 쪽)을 볼 수 있어, 은하수가 겨울철보다 두껍고 밝게 관찰돼요. 겨울철에는 B 방향(은하 바깥쪽)을 보게 돼요."
        next={{ label: '다음: 우리은하의 모양과 크기', onClick: () => goTo('shape') }}
      />
      <p className="note">모둠 활동: 질문 2의 까닭을 모둠원에게 말로 설명해 보고, 서로의 설명을 비교해 보세요.</p>
    </>
  );
  return <ModuleShell override={shell} stage={stage} panel={panel} onReset={() => setPick(null)} />;
}
