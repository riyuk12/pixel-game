// Shrinks each concept image to the game's real render size (480×270, 64 colours) so the
// gallery can show what survives at in-game pixel density.  Usage: node art-src/concepts-gameres.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, '..', 'concepts', 'gameres');
fs.mkdirSync(OUT, { recursive: true });
const concepts = JSON.parse(fs.readFileSync(path.join(ROOT, 'concepts.json'), 'utf8'));
for (const c of concepts) {
  const src = path.join(ROOT, 'raw', `${c.id}.png`);
  if (!fs.existsSync(src)) continue;
  await sharp(src).resize(480, 270, { fit: 'cover', kernel: 'lanczos3' }).png({ palette: true, colours: 64, dither: 0.6 }).toFile(path.join(OUT, `${c.id}.png`));
  console.log('game-res', c.id);
}
