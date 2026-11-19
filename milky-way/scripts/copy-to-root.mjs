// 빌드한 단일 HTML(dist/index.html)을 저장소 맨 위의 milkyway.html로 복사한다.
// '태양계 탐험'(index.html), '천체 망원경 관측'(telescope.html)과 같은 방식으로 GitHub Pages에서 열린다.
import { copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, '../dist/index.html');
const to = resolve(here, '../../milkyway.html');
copyFileSync(from, to);
console.log(`복사 완료: ${to} (${(statSync(to).size / 1024 / 1024).toFixed(2)} MB)`);
