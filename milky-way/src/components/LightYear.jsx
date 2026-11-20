import { Modal } from './ui.jsx';

const ROWS = [
  { what: '지구 → 달', dist: '약 38만 km', time: '약 1.3초' },
  { what: '태양 → 지구', dist: '약 1억 5천만 km', time: '약 8분 20초' },
  { what: '태양 → 해왕성', dist: '약 45억 km', time: '약 4시간' },
  { what: '태양 → 가장 가까운 별(프록시마 센타우리)', dist: '약 4.2광년', time: '약 4.2년' },
  { what: '태양 → 플레이아데스 성단', dist: '약 440광년', time: '약 440년' },
  { what: '태양 → 우리은하 중심', dist: '약 8500 pc (약 2만 8천 광년)', time: '약 2만 8천 년' },
  { what: '우리은하 한쪽 끝 → 반대쪽 끝(지름)', dist: '약 30000 pc (약 10만 광년)', time: '약 10만 년' },
];

export default function LightYear({ onClose }) {
  return (
    <Modal title="광년과 파섹(pc)" onClose={onClose}>
      <p style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>
        <b style={{ color: 'var(--gold)' }}>1광년</b>은 <b>빛이 1년 동안 가는 거리</b>예요. 시간의 단위가 아니라 <b>거리의 단위</b>랍니다.
      </p>
      <svg viewBox="0 0 600 120" style={{ width: '100%', height: 'auto', display: 'block', margin: '.4rem 0 .6rem' }} role="img" aria-label="빛이 1초에 지구를 7바퀴 반 도는 모습">
        <defs>
          <radialGradient id="ly-e" cx="40%" cy="35%">
            <stop offset="0" stopColor="#7cc4ff" />
            <stop offset="1" stopColor="#1d4f9a" />
          </radialGradient>
        </defs>
        <circle cx="90" cy="60" r="40" fill="url(#ly-e)" />
        <circle cx="90" cy="60" r="50" fill="none" stroke="#ffe14d" strokeWidth="2.5" strokeDasharray="10 8">
          <animateTransform attributeName="transform" type="rotate" from="0 90 60" to="360 90 60" dur="0.9s" repeatCount="indefinite" />
        </circle>
        <text x="160" y="45" fill="#f4f7ff" fontSize="20" fontWeight="700">빛의 속력: 1초에 약 30만 km</text>
        <text x="160" y="75" fill="#d5e0f7" fontSize="17">→ 1초에 지구 둘레를 약 7바퀴 반!</text>
        <text x="160" y="102" fill="#aebbd8" fontSize="15">(애니메이션은 실제보다 훨씬 느리게 표현)</text>
      </svg>
      <p>
        1년은 약 3156만 초이므로, 1광년 = 30만 km/s × 3156만 초 ≈ <b>9조 4600억 km</b> (9.46 × 10¹² km)예요. 자동차(시속 100 km)로 쉬지 않고 달리면 약
        1천만 년이 걸리는 거리예요.
      </p>
      <table className="cmp" style={{ margin: '.6rem 0' }}>
        <thead>
          <tr>
            <th>빛이 가는 길</th>
            <th>거리</th>
            <th>빛으로 걸리는 시간</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.what}>
              <td style={{ color: 'var(--ink)' }}>{r.what}</td>
              <td>{r.dist}</td>
              <td>{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card">
        <h3>파섹(pc)</h3>
        <p>
          교과서에서는 우리은하의 크기를 <b>파섹(pc)</b>으로 나타내요. <b>1 pc는 연주 시차가 1″(1초)인 별까지의 거리</b>로, 약 <b>3.26광년</b>(약 3×10¹³ km)이에요.
        </p>
        <p>
          우리은하의 지름 약 30000 pc ≈ 약 10만 광년 · 태양계에서 은하 중심까지 약 8500 pc ≈ 약 2만 8천 광년
        </p>
      </div>
      <p>
        💡 <b>그래서 별빛은 과거에서 온 빛이에요.</b> 은하 중심 쪽에서 지금 우리 눈에 들어온 빛은 약 2만 8천 년 전에 출발한 빛이에요.
      </p>
      <p className="note">천문학에서는 태양계 안의 거리는 주로 천문단위(AU, 지구–태양 거리)를, 별과 은하의 거리는 광년이나 파섹을 써요.</p>
    </Modal>
  );
}
