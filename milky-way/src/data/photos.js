// 실제 천체 사진 (위키미디어 공용에서 내려받아 파일 안에 넣음 → 인터넷 없이도 보임)
// 사진이 없거나 열리지 않으면 각 화면은 자체 그림(src/lib/art.js)으로 대신 보여 준다.
const files = import.meta.glob('../assets/img/*.jpg', { eager: true, query: '?url', import: 'default' });
const src = (k) => files[`../assets/img/${k}.jpg`] || null;

export const PHOTOS = {
  pleiades: { src: src('pleiades'), art: 'pleiades', credit: '사진: NASA, ESA, AURA/Caltech, Palomar Observatory (공공 저작물)' },
  hyades: { src: src('hyades'), art: 'hyades', credit: '사진: NOIRLab/NSF/AURA/Digitized Sky Survey 2 (CC BY 4.0)' },
  m13: { src: src('m13'), art: 'm13', credit: '사진: NASA, ESA, Hubble Heritage Team (STScI/AURA) (공공 저작물)' },
  omega: { src: src('omegacen'), art: 'omega', credit: '사진: ESO/S. Brunier (CC BY 4.0)' },
  orion: { src: src('orion'), art: 'emission', credit: '사진: NASA, ESA, M. Robberto (STScI/ESA), Hubble Orion Treasury Project Team (공공 저작물)' },
  // 메로페 성운 사진이 없으면, 반사 성운이 잘 보이는 플레이아데스 사진을 쓴다
  merope: src('merope')
    ? { src: src('merope'), art: 'reflection', credit: '사진: NOIRLab/NSF/AURA (CC BY 4.0)' }
    : { src: src('pleiades'), art: 'reflection', credit: '사진: NASA, ESA, AURA/Caltech, Palomar Observatory (공공 저작물) — 별 둘레의 푸른 빛이 반사 성운' },
  horsehead: src('horsehead')
    ? { src: src('horsehead'), art: 'dark', credit: '사진: ESO (CC BY 4.0)' }
    : {
        src: src('horsehead_dss'),
        art: 'dark',
        credit: '사진: Digitized Sky Survey(STScI), UK Schmidt Telescope © AAO/ROE — 교육용 비영리 사용, 흑백 사진에 붉은색을 입힘',
      },
};

/** 은하 좌표로 펼친 전천 은하수 사진(가로 360° × 세로 180°, 가운데가 은하 중심) */
export const MILKY_WAY_PANORAMA = { src: src('milkyway'), credit: '은하수 전천 사진: ESO/S. Brunier (CC BY 4.0)' };

/** 지구 지도(NASA Blue Marble, 공공 저작물) — ‘태양계 탐험’ 자료와 같은 그림 */
export const EARTH_MAP = { src: src('earth'), credit: '지구 지도: NASA Blue Marble (공공 저작물)' };
