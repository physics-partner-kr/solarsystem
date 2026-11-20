// 탐구 '우리은하를 구성하는 천체 관측하기'에서 검색하는 천체 (교과서 예시 + 그림 11 천체)
// 좌표: J2000 적경·적위(도). 거리는 대표값.

export const TYPES = {
  open: { name: '산개 성단', group: '성단', color: '#8fd0ff' },
  globular: { name: '구상 성단', group: '성단', color: '#ffb37a' },
  emission: { name: '방출 성운', group: '성운', color: '#ff7aa2' },
  reflection: { name: '반사 성운', group: '성운', color: '#7fb2ff' },
  dark: { name: '암흑 성운', group: '성운', color: '#c9ad8f' },
};

// 관찰된 공통 특징(기록표에서 고르는 말)
export const FEATURES = {
  scatter: '별들이 일정한 모양 없이 모여 있다.',
  ball: '별들이 공 모양으로 빽빽하게 모여 있다.',
  blueStars: '주로 파란색 별들로 이루어져 있다.',
  redStars: '주로 붉은색(노란색) 별들로 이루어져 있다.',
  cloud: '구름처럼 퍼져 보인다.',
  redLight: '붉은색의 빛을 낸다.',
  blueLight: '파란색의 빛을 낸다.',
  darkLight: '검게 보이며 뒤에서 오는 별빛을 가린다.',
};
// 종류별: 꼭 있어야 하는 특징(key)과 함께 골라도 되는 특징(ok)
export const TYPE_FEATURES = {
  open: { key: ['scatter'], ok: ['blueStars'] },
  globular: { key: ['ball'], ok: ['redStars'] },
  emission: { key: ['redLight'], ok: ['cloud'] },
  reflection: { key: ['blueLight'], ok: ['cloud'] },
  dark: { key: ['darkLight'], ok: ['cloud'] },
};

export const OBJECTS = [
  // 성단 — 교과서 예시
  { id: 'm44', name: '벌집 성단', code: 'NGC 2632 · M44', type: 'open', ra: 130.1, dec: 19.67, con: '게자리', dist: '약 180 pc(약 580광년)', photo: 'm44', art: 'beehive', textbook: true,
    note: '맨눈으로는 뿌연 얼룩처럼 보이지만, 쌍안경으로 보면 별 수십 개가 흩어져 보여요.' },
  { id: 'tuc47', name: '큰부리새자리 47', code: 'NGC 104', type: 'globular', ra: 6.02, dec: -72.08, con: '큰부리새자리', dist: '약 4500 pc(약 1만 5천 광년)', photo: 'tuc47', art: 'globular', textbook: true,
    note: '남쪽 하늘의 천체라 우리나라에서는 지평선 위로 떠오르지 않아요. 지평선을 없애야 볼 수 있어요.' },
  { id: 'omega', name: '센타우루스자리 오메가 성단', code: 'NGC 5139', type: 'globular', ra: 201.7, dec: -47.48, con: '센타우루스자리', dist: '약 5200 pc(약 1만 7천 광년)', photo: 'omega', art: 'omega', textbook: true,
    note: '우리은하에서 가장 크고 밝은 구상 성단으로, 약 1000만 개의 별이 모여 있어요.' },
  { id: 'jewel', name: '보석 상자', code: 'NGC 4755', type: 'open', ra: 193.4, dec: -60.33, con: '남십자자리', dist: '약 2000 pc(약 6400광년)', photo: 'jewelbox', art: 'jewel', textbook: true,
    note: '파란색의 밝은 별들 사이에 붉은 별 하나가 있어 보석 상자처럼 보여요.' },
  // 성운 — 교과서 예시
  { id: 'runningman', name: '런닝맨 성운', code: 'NGC 1973', type: 'reflection', ra: 83.88, dec: -4.83, con: '오리온자리', dist: '약 460 pc(약 1500광년)', photo: 'runningman', art: 'runningman', textbook: true,
    note: '오리온 대성운 바로 북쪽에 있어요. 어두운 부분이 달리는 사람처럼 보여요.' },
  { id: 'coalsack', name: '석탄 포대 성운', code: 'C 99', type: 'dark', ra: 192.5, dec: -62.5, con: '남십자자리', dist: '약 180 pc(약 600광년)', photo: 'coalsack', art: 'coalsack', textbook: true,
    note: '남쪽 은하수 한가운데에 검은 구멍처럼 보여요. 남쪽 하늘이라 지평선을 없애야 볼 수 있어요.' },
  { id: 'chicken', name: '달리는 닭 성운', code: 'C 100 · IC 2944', type: 'emission', ra: 174.58, dec: -63.37, con: '센타우루스자리', dist: '약 1800 pc(약 6000광년)', photo: 'chicken', art: 'chicken', textbook: true,
    note: '젊고 뜨거운 별들이 둘러싼 수소 기체를 빛나게 해요.' },
  { id: 'crescent', name: '초승달 성운', code: 'NGC 6888', type: 'emission', ra: 303.03, dec: 38.35, con: '백조자리', dist: '약 1500 pc(약 5000광년)', photo: 'crescent', art: 'crescent', textbook: true,
    note: '아주 뜨거운 별이 내뿜는 물질과 에너지로 기체가 초승달 모양으로 빛나요.' },
  { id: 'iris', name: '아이리스 성운', code: 'C 4 · NGC 7023', type: 'reflection', ra: 315.4, dec: 68.17, con: '세페우스자리', dist: '약 400 pc(약 1300광년)', photo: 'iris', art: 'iris', textbook: true,
    note: '가운데의 밝은 별빛을 둘레의 먼지가 반사해 꽃잎처럼 보여요.' },
  // 그림 11 천체
  { id: 'pleiades', name: '좀생이성단', code: '플레이아데스 · M45', type: 'open', ra: 56.75, dec: 24.12, con: '황소자리', dist: '약 140 pc(약 440광년)', photo: 'pleiades', art: 'pleiades',
    note: '맨눈으로도 별 6~7개가 모여 보여요. 둘레의 푸른 빛은 반사 성운이에요.' },
  { id: 'm80', name: 'NGC 6093', code: 'M80', type: 'globular', ra: 244.26, dec: -22.98, con: '전갈자리', dist: '약 10000 pc(약 3만 2천 광년)', photo: 'm80', art: 'globular',
    note: '수십만 개의 별이 아주 빽빽하게 모인 구상 성단이에요.' },
  { id: 'm13', name: '헤르쿨레스자리 구상 성단', code: 'M13', type: 'globular', ra: 250.42, dec: 36.46, con: '헤르쿨레스자리', dist: '약 6800 pc(약 2만 2천 광년)', photo: 'm13', art: 'm13',
    note: '우리나라 여름철 밤하늘에서 망원경으로 볼 수 있는 대표적인 구상 성단이에요.' },
  { id: 'rosette', name: '장미성운', code: 'NGC 2237', type: 'emission', ra: 98.44, dec: 4.98, con: '외뿔소자리', dist: '약 1600 pc(약 5200광년)', photo: 'rosette', art: 'rosette',
    note: '가운데의 젊은 별들(산개 성단)이 둘레의 기체를 빛나게 해 장미꽃처럼 보여요.' },
  { id: 'witch', name: '마귀할멈성운', code: 'IC 2118', type: 'reflection', ra: 76.0, dec: -7.25, con: '에리다누스자리', dist: '약 270 pc(약 900광년)', photo: 'witchhead', art: 'witch',
    note: '가까이 있는 밝은 별 리겔의 빛을 반사해 파랗게 보여요.' },
  { id: 'horsehead', name: '말머리성운', code: 'B 33', type: 'dark', ra: 85.25, dec: -2.46, con: '오리온자리', dist: '약 420 pc(약 1400광년)', photo: 'horsehead', art: 'dark',
    note: '뒤쪽의 붉은 방출 성운 앞을 먼지 구름이 가려 말 머리 모양으로 보여요.' },
  { id: 'orion', name: '오리온 대성운', code: 'M42', type: 'emission', ra: 83.82, dec: -5.39, con: '오리온자리', dist: '약 410 pc(약 1300광년)', photo: 'orion', art: 'emission',
    note: '지금도 새로운 별이 태어나고 있는, 가장 유명한 방출 성운이에요.' },
];

/** 기록 채점: 종류가 맞고, 꼭 있어야 할 특징이 있고, 다른 종류의 특징이 섞이지 않았는지 */
export function judgeRecord(obj, features, type) {
  if (!type || !features.length) return { ok: false, reason: 'empty' };
  const tf = TYPE_FEATURES[obj.type];
  const allowed = new Set([...tf.key, ...tf.ok]);
  if (type !== obj.type) return { ok: false, reason: 'type' };
  if (!tf.key.every((k) => features.includes(k))) return { ok: false, reason: 'missing' };
  if (features.some((f) => !allowed.has(f))) return { ok: false, reason: 'extra' };
  return { ok: true };
}
