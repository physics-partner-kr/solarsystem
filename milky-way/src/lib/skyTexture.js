// 전천 은하수 사진(은하 좌표, 가로 360°·세로 180°)을 불러오고, 없으면 대신 그린 그림을 쓴다.
import * as THREE from 'three';
import { MILKY_WAY_PANORAMA } from '../data/photos.js';
import { rng } from './galaxy.js';

let IMG_PROMISE = null;
let LUM = null;

function fallbackPanorama() {
  // 은하 좌표에서 은하수 밝기를 단순 모형으로 그림(중심 쪽 밝고, 반대쪽 어두움, 먼지 띠)
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const R = rng(5);
  for (let y = 0; y < H; y++) {
    const b = 90 - (y / H) * 180;
    for (let x = 0; x < W; x++) {
      let l = 180 - (x / W) * 360; // 가운데 0, 왼쪽으로 증가
      const lc = Math.abs(l);
      const width = 7 + 6 * Math.exp(-(lc * lc) / (2 * 30 * 30));
      const band = Math.exp(-(b * b) / (2 * width * width));
      const center = 0.3 + 0.7 * Math.exp(-(lc * lc) / (2 * 55 * 55));
      const bulge = 0.9 * Math.exp(-(l * l + b * b * 1.6) / (2 * 9 * 9));
      const rift = l > -10 && l < 70 ? 1 - 0.55 * Math.exp(-((b - 1 + l * 0.02) ** 2) / 2.5) : 1;
      let v = (band * center + bulge) * rift;
      v = Math.min(1, v * 0.85 + (R() < 0.004 ? R() : 0));
      const i = (y * W + x) * 4;
      img.data[i] = 255 * v * 0.95;
      img.data[i + 1] = 255 * v * 0.9;
      img.data[i + 2] = 255 * v * 0.85;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function loadPanorama() {
  if (!IMG_PROMISE) {
    IMG_PROMISE = new Promise((resolve) => {
      if (!MILKY_WAY_PANORAMA.src) {
        resolve({ image: fallbackPanorama(), photo: false });
        return;
      }
      const im = new Image();
      im.onload = () => resolve({ image: im, photo: true });
      im.onerror = () => resolve({ image: fallbackPanorama(), photo: false });
      im.src = MILKY_WAY_PANORAMA.src;
    });
  }
  return IMG_PROMISE;
}

export function makeTexture(image) {
  const t = new THREE.Texture(image);
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  return t;
}

/** 은하 좌표 1°×1° 칸마다 사진의 밝기(0~1). 은하수 밝기 비교 계산용 */
export async function panoramaLuminance() {
  if (LUM) return LUM;
  const { image } = await loadPanorama();
  const W = 360;
  const H = 180;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4] / 255;
    const gg = d[i * 4 + 1] / 255;
    const b = d[i * 4 + 2] / 255;
    // 사진은 감마 보정된 값이므로 빛의 양으로 되돌림
    raw[i] = Math.pow(0.2126 * r + 0.7152 * gg + 0.0722 * b, 2.2);
  }
  // 3×3 평균(별 하나하나보다 은하수의 퍼진 빛을 보기 위해)
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          s += raw[yy * W + ((x + dx + W) % W)];
          n++;
        }
      }
      lum[y * W + x] = s / n;
    }
  }
  // 은하수에서 먼 하늘(|은위| > 50°)의 밝기 = 배경
  const hi = [];
  for (let y = 0; y < H; y++) if (Math.abs(90 - (y + 0.5)) > 50) for (let x = 0; x < W; x += 3) hi.push(lum[y * W + x]);
  hi.sort((a, b) => a - b);
  const bg = hi[Math.floor(hi.length / 2)] || 0;
  for (let i = 0; i < W * H; i++) lum[i] = Math.max(0, lum[i] - bg);
  LUM = { W, H, lum };
  return LUM;
}

// GLSL: 은하 좌표 방향 → 사진 색
export const GLSL_PANO = `
uniform sampler2D uPano;
const float PI = 3.141592653589793;
vec3 panoColor(vec3 gdir) {
  float l = atan(gdir.y, gdir.x);
  float b = asin(clamp(gdir.z, -1.0, 1.0));
  float u1 = 0.5 - l / (2.0 * PI);
  float u2 = fract(u1 + 0.5) - 0.5; // 이음매에서 밉맵이 튀지 않도록
  float u = fwidth(u1) <= fwidth(u2) ? u1 : u2;
  float v = 0.5 + b / PI;
  return texture2D(uPano, vec2(u, v)).rgb;
}`;
