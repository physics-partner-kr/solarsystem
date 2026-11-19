// 성운이 보이는 원리 그림 (빛의 출발점과 경로)
const EYE = (x, y) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-26 0 Q0 -20 26 0 Q0 20 -26 0Z" fill="#e8eeff" />
    <circle r="9" fill="#2b5fae" />
    <circle r="4" fill="#06122b" />
    <text y="38" textAnchor="middle" fill="#d5e0f7" fontSize="15" fontWeight="600">
      관측자(지구)
    </text>
  </g>
);

function Arrow({ d, color, dash = '8 8', width = 3, speed = 1.2, head = true, id }) {
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} markerEnd={head ? `url(#ah-${id})` : undefined} opacity="0.95">
        <animate attributeName="stroke-dashoffset" from="32" to="0" dur={`${speed}s`} repeatCount="indefinite" />
      </path>
    </g>
  );
}

function Defs({ colors }) {
  return (
    <defs>
      {Object.entries(colors).map(([id, c]) => (
        <marker key={id} id={`ah-${id}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={c} />
        </marker>
      ))}
      <radialGradient id="neb-red" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ff8fb0" stopOpacity="0.95" />
        <stop offset="0.55" stopColor="#e2386a" stopOpacity="0.55" />
        <stop offset="1" stopColor="#8a1236" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="neb-blue" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#a9c8ff" stopOpacity="0.85" />
        <stop offset="0.6" stopColor="#4f7fe0" stopOpacity="0.4" />
        <stop offset="1" stopColor="#1d3a8a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="neb-bg" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ff6d8f" stopOpacity="0.8" />
        <stop offset="1" stopColor="#7a1530" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="star-hot" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.35" stopColor="#bcd5ff" />
        <stop offset="1" stopColor="#5d8cff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="star-w" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.35" stopColor="#fff3d6" />
        <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export default function NebulaDiagram({ kind, compact = false }) {
  const vb = '0 0 640 300';
  const common = { viewBox: vb, style: { width: '100%', height: '100%', display: 'block' }, role: 'img' };
  if (kind === 'emission') {
    return (
      <svg {...common} aria-label="방출 성운: 뜨거운 별이 기체에 에너지를 주어 기체가 스스로 빛을 냄">
        <Defs colors={{ uv: '#b98cff', red: '#ff6d8f' }} />
        <circle cx="200" cy="150" r="125" fill="url(#neb-red)">
          <animate attributeName="r" values="120;128;120" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="150" r="30" fill="url(#star-hot)" />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const r1 = 26;
          const r2 = 85;
          const c = Math.cos((a * Math.PI) / 180);
          const s = Math.sin((a * Math.PI) / 180);
          return <Arrow key={a} id="uv" d={`M${200 + c * r1} ${150 + s * r1} L${200 + c * r2} ${150 + s * r2}`} color="#b98cff" dash="6 6" speed={0.9} />;
        })}
        <Arrow id="red" d="M320 150 L500 150" color="#ff6d8f" width={4} />
        {EYE(560, 150)}
        {!compact && (
          <>
            <text x="200" y="28" textAnchor="middle" fill="#ffd0dc" fontSize="16" fontWeight="700">
              뜨거운 젊은 별 → 자외선 에너지
            </text>
            <text x="200" y="290" textAnchor="middle" fill="#ffb3c6" fontSize="15">
              에너지를 받은 수소 기체가 스스로 붉은빛을 냄
            </text>
            <text x="410" y="138" textAnchor="middle" fill="#ff9db5" fontSize="14">
              기체가 낸 빛
            </text>
          </>
        )}
      </svg>
    );
  }
  if (kind === 'reflection') {
    return (
      <svg {...common} aria-label="반사 성운: 근처 별빛을 먼지가 반사해 푸르게 보임">
        <Defs colors={{ star: '#ffe7a6', blue: '#7fb2ff' }} />
        <ellipse cx="300" cy="150" rx="120" ry="95" fill="url(#neb-blue)" />
        {Array.from({ length: 36 }, (_, i) => (
          <circle key={i} cx={210 + ((i * 53) % 180)} cy={80 + ((i * 37) % 140)} r="2.2" fill="#c9dbff" opacity="0.7" />
        ))}
        <circle cx="90" cy="150" r="34" fill="url(#star-w)" />
        <Arrow id="star" d="M125 130 L235 115" color="#ffe7a6" />
        <Arrow id="star" d="M125 150 L240 150" color="#ffe7a6" />
        <Arrow id="star" d="M125 170 L235 185" color="#ffe7a6" />
        <Arrow id="blue" d="M330 150 L500 150" color="#7fb2ff" width={4} />
        {EYE(560, 150)}
        {!compact && (
          <>
            <text x="90" y="215" textAnchor="middle" fill="#ffe7a6" fontSize="15" fontWeight="700">
              근처의 밝은 별
            </text>
            <text x="300" y="34" textAnchor="middle" fill="#cfe0ff" fontSize="16" fontWeight="700">
              먼지 구름(스스로 빛을 내지 못함)
            </text>
            <text x="320" y="285" textAnchor="middle" fill="#a9c8ff" fontSize="15">
              먼지가 별빛 중 파란빛을 더 잘 흩뜨려 푸르게 보임
            </text>
            <text x="420" y="138" textAnchor="middle" fill="#a9c8ff" fontSize="14">
              반사된 별빛
            </text>
          </>
        )}
      </svg>
    );
  }
  // dark
  return (
    <svg {...common} aria-label="암흑 성운: 짙은 먼지 구름이 뒤쪽 빛을 가려 어둡게 보임">
      <Defs colors={{ bg: '#ff6d8f' }} />
      <ellipse cx="120" cy="150" rx="110" ry="130" fill="url(#neb-bg)" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={40 + ((i * 41) % 150)} cy={30 + ((i * 67) % 240)} r="2" fill="#fff" opacity="0.8" />
      ))}
      <Arrow id="bg" d="M170 70 L470 70" color="#ff6d8f" />
      <Arrow id="bg" d="M170 230 L470 230" color="#ff6d8f" />
      <Arrow id="bg" d="M170 150 L255 150" color="#ff6d8f" />
      <path d="M260 85 C 300 60, 360 75, 370 110 C 395 130, 380 175, 360 200 C 330 235, 280 225, 265 195 C 245 165, 240 120, 260 85Z" fill="#120a0c" stroke="#5b4636" strokeWidth="2" />
      <text x="315" y="152" textAnchor="middle" fill="#c9ad8f" fontSize="15" fontWeight="700">
        짙은
      </text>
      <text x="315" y="172" textAnchor="middle" fill="#c9ad8f" fontSize="15" fontWeight="700">
        먼지 구름
      </text>
      <path d="M390 150 L470 150" stroke="#5b4636" strokeWidth="3" strokeDasharray="4 6" />
      <text x="430" y="140" textAnchor="middle" fill="#c9ad8f" fontSize="13">
        빛이 막힘
      </text>
      {EYE(560, 150)}
      {!compact && (
        <>
          <text x="120" y="22" textAnchor="middle" fill="#ffb3c6" fontSize="15" fontWeight="700">
            뒤쪽의 밝은 성운·별빛
          </text>
          <text x="330" y="290" textAnchor="middle" fill="#d8c0a4" fontSize="15">
            가린 부분만 검은 그림자처럼 보임
          </text>
        </>
      )}
    </svg>
  );
}
