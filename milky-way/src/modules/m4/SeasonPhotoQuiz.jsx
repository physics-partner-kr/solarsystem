import SkyView from './SkyView.jsx';
import { hourLabel, kstDate } from '../../lib/astro.js';
import { CONFIG } from '../../config.js';

// '우리나라에서 찍은 전천 사진은 어느 계절의 은하수일까?' — 교과서 문제처럼 두 사진을 비교해 맞히기
export const SEASON_NAME = { summer: '여름', winter: '겨울' };
export const SEASON_COLOR = { summer: '#ff9d5c', winter: '#7fd0ff' };
const HOURS = [22, 24, 26, 23, 25];

/** 문제 묶음 만들기: 촬영 시각, 사진 순서, 사진 회전(카메라 방향)을 무작위로 */
export function makeRounds(n = 3) {
  const hours = [...HOURS].sort(() => Math.random() - 0.5);
  return Array.from({ length: n }, (_, i) => {
    const summerFirst = Math.random() < 0.5;
    return {
      hour: hours[i % hours.length],
      photos: (summerFirst ? ['summer', 'winter'] : ['winter', 'summer']).map((season) => ({ season, rot: Math.round(Math.random() * 360) })),
    };
  });
}

export function photoDate(season, hour) {
  const d = season === 'summer' ? CONFIG.summerDate : CONFIG.winterDate;
  return kstDate(d.year, d.month, d.day, hour);
}

const TAGS = ['가', '나'];

export default function SeasonPhotoQuiz({ round, answers, setAnswer, checked, wrong = [], reveal }) {
  return (
    <div className="pq-grid">
      {round.photos.map((ph, i) => {
        const ans = answers[i];
        const ok = checked && ans === ph.season;
        const bad = !checked && wrong.includes(i);
        const border = checked ? SEASON_COLOR[ph.season] : 'var(--line)';
        return (
          <section key={i} className="pq-card" style={{ borderColor: border }} aria-label={`사진 ${TAGS[i]}`}>
            <div className="pq-photo">
              <SkyView
                date={photoDate(ph.season, round.hour)}
                mode="dome"
                photo
                rot={ph.rot}
                lines={reveal}
                names={reveal}
                galEq={reveal}
                light={0}
                twilight={false}
                compact
              />
              <span className="pq-tag">사진 {TAGS[i]}</span>
            </div>
            <div className="pq-answer">
              <div className="pq-blank">
                <span className={`pq-fill ${ans ? 'on' : ''}`} style={ans ? { color: SEASON_COLOR[ans] } : undefined}>
                  {ans ? SEASON_NAME[ans] : ' '}
                </span>
                <span>철 은하수</span>
                {ok && <b className="pq-mark ok">○</b>}
                {bad && <b className="pq-mark bad">×</b>}
              </div>
              <div className="pq-choices" role="radiogroup" aria-label={`사진 ${TAGS[i]}의 계절`}>
                {['summer', 'winter'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={ans === s}
                    disabled={checked}
                    onClick={() => setAnswer(i, s)}
                    style={ans === s ? { background: SEASON_COLOR[s], color: '#0b1530' } : undefined}
                  >
                    {SEASON_NAME[s]}철
                  </button>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <p className="pq-caption">
        서울 근처 어두운 곳에서 하늘 전체를 찍은 모습(어안 렌즈 전천 사진처럼 만든 시뮬레이션) · 두 사진 모두 {hourLabel(round.hour)} 무렵 · 사진의 방향은 제각각이에요
      </p>
    </div>
  );
}
