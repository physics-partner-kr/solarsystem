"""d3-celestial(BSD-3-Clause, Olaf Frohn) 자료를 앱에서 쓰기 좋은 작은 JS 모듈로 바꾼다.
사용: python3 scripts/prepare-sky-data.py <d3-celestial/data 폴더> > src/data/skyData.js
"""
import json, sys, os
src = sys.argv[1]
ld = lambda f: json.load(open(os.path.join(src, f), encoding='utf-8'))
ra = lambda lon: lon + 360 if lon < 0 else lon
stars = ld('stars.6.json')['features']
flat = []
for s in sorted(stars, key=lambda s: s['properties']['mag']):
    m = s['properties']['mag']
    if m > 6.0: continue
    lon, lat = s['geometry']['coordinates']
    try: bv = float(s['properties'].get('bv') or 0.6)
    except ValueError: bv = 0.6
    flat += [round(ra(lon), 3), round(lat, 3), round(m, 2), round(bv, 2)]
lines = {}
for f in ld('constellations.lines.json')['features']:
    lines[f['id']] = [[v for p in seg for v in (round(ra(p[0]), 2), round(p[1], 2))] for seg in f['geometry']['coordinates']]
names = []
for f in ld('constellations.json')['features']:
    p = f['properties']; lon, lat = f['geometry']['coordinates']
    names.append([f['id'], p.get('ko') or p['name'], round(ra(lon), 2), round(lat, 2), int(p.get('rank', 3))])
print('// 자동 생성 파일: scripts/prepare-sky-data.py')
print('// 자료 출처: d3-celestial (Olaf Frohn, BSD-3-Clause) — 예일 밝은 별 목록(BSC5) 기반 별 위치·등급, IAU 별자리 선')
print('// 별: [적경(도), 적위(도), 겉보기 등급, B-V 색지수] 반복 — 6등급까지 %d개' % (len(flat)//4))
print('export const STARS = new Float32Array(%s);' % json.dumps(flat, separators=(',', ':')))
print('export const CONST_LINES = %s;' % json.dumps(lines, separators=(',', ':')))
print('export const CONST_NAMES = %s;' % json.dumps(names, ensure_ascii=False, separators=(',', ':')))
