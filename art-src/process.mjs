// Turns raw Gemini output into game-ready pixel assets.
//  - tile textures: made seamless, shrunk to 128px, palette-reduced  -> public/textures/
//  - decals:        shrunk to 96x144, palette-reduced                  -> public/textures/
//  - portraits:     shrunk to 96px so every pixel is a real pixel      -> public/ui/
//  - key art:       shrunk to 480x270                                  -> public/ui/
//  - KayKit character textures: recoloured for the setting            -> public/textures/
// Usage: node art-src/process.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PUB = path.join(ROOT, '..', 'public');
const RAW = path.join(ROOT, 'raw');
const PREVIEW = path.join(ROOT, 'preview');
for (const d of ['textures', 'ui']) fs.mkdirSync(path.join(PUB, d), { recursive: true });
fs.mkdirSync(PREVIEW, { recursive: true });

const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Seamless tiling: blend the image with a copy shifted by half a tile, one axis at a time.
// The shifted copy is used near the edges (where it wraps cleanly) and the original in the middle.
function makeSeamless(data, size, ch) {
  const half = size / 2;
  const out = Buffer.from(data);
  for (const axis of ['x', 'y']) {
    const src = Buffer.from(out);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = axis === 'x' ? Math.min(x, size - 1 - x) : Math.min(y, size - 1 - y);
        const w = smooth(0.1 * size, 0.4 * size, d);
        const sx = axis === 'x' ? (x + half) % size : x;
        const sy = axis === 'y' ? (y + half) % size : y;
        const i = (y * size + x) * ch;
        const j = (sy * size + sx) * ch;
        for (let c = 0; c < ch; c++) out[i + c] = Math.round(src[i + c] * w + src[j + c] * (1 - w));
      }
    }
  }
  return out;
}

async function processTile(id) {
  const W = 512;
  const { data, info } = await sharp(path.join(RAW, `${id}.png`))
    .resize(W, W, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seamless = makeSeamless(data, W, info.channels);
  const small = await sharp(seamless, { raw: { width: W, height: W, channels: info.channels } })
    .resize(128, 128, { kernel: 'lanczos3' })
    .png({ palette: true, colours: 32, dither: 0 })
    .toBuffer();
  await sharp(small).toFile(path.join(PUB, 'textures', `${id}.png`));
  // 2x2 tiled preview to eyeball seams.
  const big = await sharp(small).resize(256, 256, { kernel: 'nearest' }).toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 3, background: '#000' } })
    .composite([0, 1, 2, 3].map((k) => ({ input: big, left: (k % 2) * 256, top: Math.floor(k / 2) * 256 })))
    .png()
    .toFile(path.join(PREVIEW, `${id}_tiled.png`));
}

async function processSized(id, dir, w, h, colours) {
  await sharp(path.join(RAW, `${id}.png`))
    .resize(w, h, { fit: 'cover', kernel: 'lanczos3' })
    .png({ palette: true, colours, dither: 0 })
    .toFile(path.join(PUB, dir, `${id}.png`));
}

/**
 * Normal map from a texture's brightness (Sobel on luminance) so lit surfaces show relief.
 * Writes public/textures/<id>_n.png next to the colour map.
 */
async function normalMap(id, wrap) {
  const file = path.join(PUB, 'textures', `${id}.png`);
  const { data, info } = await sharp(file).removeAlpha().blur(0.6).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const lum = (x, y) => {
    if (wrap) [x, y] = [(x + w) % w, (y + h) % h];
    else [x, y] = [Math.min(w - 1, Math.max(0, x)), Math.min(h - 1, Math.max(0, y))];
    const i = (y * w + x) * ch;
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  };
  const out = Buffer.alloc(w * h * 3);
  const strength = 3.2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1) - lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1);
      const gy = lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1) - lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1);
      let nx = -gx * strength;
      let ny = gy * strength; // image y runs down, texture v runs up
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 3;
      out[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toFile(path.join(PUB, 'textures', `${id}_n.png`));
}

// --- Character recolour -------------------------------------------------------------------
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

// Each rule: [hueMin, hueMax, minSat, minLight] -> (h,s,l) => [h,s,l]
const SKIN = [5, 40, 0.3, 0.62, (h, s, l) => [h + 2, s * 0.75, l * 0.62]];
const RECOLOURS = {
  Rogue_Hooded: [
    SKIN,
    [90, 180, 0.2, 0, (h, s, l) => [242, s * 0.5, Math.min(0.7, l * 1.1)]], // green cloak -> muted indigo
  ],
  Mage: [
    SKIN,
    [215, 290, 0.15, 0, (h, s, l) => [350, Math.min(1, s + 0.25), l * 0.9]], // violet robe -> maroon
    [295, 345, 0.3, 0, (h, s, l) => [34, 0.85, Math.min(0.7, l + 0.1)]], // magenta trim -> saffron
  ],
};

// Extra costume variants for crowd NPCs: [model texture, rules] -> public/textures/char_<variant>.png
const robe = (h, sat, light) => [215, 290, 0.15, 0, (_h, s, l) => [h, sat ?? Math.min(1, s + 0.2), light ? light(l) : l]];
const trim = (h, sat, lift = 0.1) => [295, 345, 0.3, 0, (_h, _s, l) => [h, sat, Math.min(0.75, l + lift)]];
const cloak = (h, sat, light) => [90, 180, 0.2, 0, (_h, s, l) => [h, sat ?? s * 0.6, light ? light(l) : l]];
const CHAR_VARIANTS = {
  priest: ['Mage', [SKIN, robe(352, 0.75, (l) => l * 0.85), trim(44, 0.85)]],
  sadhu: ['Mage', [SKIN, robe(26, 0.9, (l) => Math.min(0.6, l + 0.12)), trim(18, 0.9)]],
  pilgrim: ['Mage', [SKIN, robe(40, 0.08, (l) => Math.min(0.85, l + 0.35)), trim(30, 0.8)]],
  seller: ['Mage', [SKIN, robe(42, 0.95, (l) => Math.min(0.62, l + 0.18)), trim(4, 0.8)]],
  dancer: ['Mage', [SKIN, robe(356, 0.85, (l) => Math.min(0.55, l + 0.08)), trim(46, 0.9)]],
  weaver: ['Mage', [SKIN, robe(214, 0.55, (l) => Math.min(0.6, l + 0.1)), trim(40, 0.2, 0.3)]],
  local: ['Rogue_Hooded', [SKIN, cloak(28, 0.45, (l) => Math.min(0.6, l + 0.05))]],
  localGreen: ['Rogue_Hooded', [SKIN, cloak(150, 0.25)]],
};

async function recolourVariant(variant, [model, rules]) {
  const { data, info } = await sharp(path.join(ROOT, 'kaykit', `${model}_tex.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    let [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    for (const [h0, h1, s0, l0, fn] of rules) {
      if (h >= h0 && h <= h1 && s >= s0 && l >= l0) {
        [h, s, l] = fn(h, s, l);
        const [r, g, b] = hslToRgb(h, s, l);
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
        break;
      }
    }
  }
  await sharp(data, { raw: info }).png().toFile(path.join(PUB, 'textures', `char_${variant}.png`));
}

async function recolour(name) {
  const src = path.join(ROOT, 'kaykit', `${name}_tex.png`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    let [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    for (const [h0, h1, s0, l0, fn] of RECOLOURS[name]) {
      if (h >= h0 && h <= h1 && s >= s0 && l >= l0) {
        [h, s, l] = fn(h, s, l);
        const [r, g, b] = hslToRgb(h, s, l);
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
        break;
      }
    }
  }
  await sharp(data, { raw: info }).png().toFile(path.join(PUB, 'textures', `${name}_recolour.png`));
}

for (const p of prompts) {
  if (!fs.existsSync(path.join(RAW, `${p.id}.png`))) continue;
  if (p.kind === 'tile') await processTile(p.id);
  else if (p.kind === 'decal') {
    const [w, h] = { '1:1': [128, 128], '3:2': [144, 96] }[p.aspect] ?? [96, 144];
    await processSized(p.id, 'textures', w, h, 40);
  }
  else if (p.kind === 'portrait') await processSized(p.id, 'ui', 96, 96, 40);
  else if (p.kind === 'keyart') await processSized(p.id, 'ui', 480, 270, 64);
  if (p.kind === 'tile' || p.kind === 'decal') await normalMap(p.id, p.kind === 'tile');
  console.log('processed', p.id);
}
for (const name of Object.keys(RECOLOURS)) {
  await recolour(name);
  console.log('recoloured', name);
}
for (const [variant, spec] of Object.entries(CHAR_VARIANTS)) {
  await recolourVariant(variant, spec);
  console.log('variant', variant);
}
