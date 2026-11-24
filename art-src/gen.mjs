// Generates game art with Gemini (Nano Banana) image models.
// Usage: node art-src/gen.mjs [id ...] [--force] [--set=concepts]   (--set picks art-src/<set>.json)
// Reads GEMINI_API_KEY from the environment. Prompts live in art-src/prompts.json.
// Entries with "refs" also receive mood-board images (moodboards/boards.json) as style references:
//   "refs": true                     -> every mood-board image (max 14)
//   "refs": ["riverfront", "alleys"] -> only images on those boards
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const RAW = path.join(ROOT, 'raw');
const BOARDS = path.join(ROOT, '..', 'moodboards');
const MODELS = { flash: 'gemini-3.1-flash-image-preview', pro: 'gemini-3-pro-image-preview' };
// Rough per-image prices (USD) for the spend log.
const PRICE = { flash: { '1K': 0.039, '2K': 0.067, '4K': 0.12 }, pro: { '1K': 0.134, '2K': 0.134, '4K': 0.24 } };
const FALLBACK = 'gemini-2.5-flash-image';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is not set');
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const SPEND_LOG = path.join(ROOT, 'spend.log');
const set = args.find((a) => a.startsWith('--set='))?.slice(6) || 'prompts';
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, `${set}.json`), 'utf8'));
const todo = prompts.filter((p) => (only.length ? only.includes(p.id) : true));
fs.mkdirSync(RAW, { recursive: true });

function refParts(refs) {
  const manifest = path.join(BOARDS, 'boards.json');
  if (!refs || !fs.existsSync(manifest)) return [];
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const { images } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  return images
    .filter((img) => refs === true || img.boards.some((b) => refs.includes(b)))
    .filter((img) => mime[path.extname(img.file).toLowerCase()])
    .slice(0, 14)
    .map((img) => ({
      inlineData: {
        mimeType: mime[path.extname(img.file).toLowerCase()],
        data: fs.readFileSync(path.join(BOARDS, img.file)).toString('base64'),
      },
    }));
}

function extraRefParts(files = []) {
  return files.map((f) => ({
    inlineData: { mimeType: 'image/png', data: fs.readFileSync(path.join(ROOT, '..', f)).toString('base64') },
  }));
}

async function call(model, entry, refs) {
  const imageConfig = { aspectRatio: entry.aspect || '1:1' };
  if (model !== FALLBACK) imageConfig.imageSize = entry.size || '1K';
  const preface = refs.length
    ? 'Use the attached images only as style and mood references (architecture, palette, lighting). Generate an image: '
    : 'Generate an image: ';
  const body = {
    contents: [{ parts: [{ text: preface + entry.prompt }, ...refs] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 1.0, imageConfig },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  return res;
}

async function generate(entry) {
  const out = path.join(RAW, `${entry.id}.png`);
  if (fs.existsSync(out) && !force) return `${entry.id}: exists, skipped`;
  const refs = [...refParts(entry.refs), ...extraRefParts(entry.extraRefs)].slice(0, 14);
  const tier = entry.model === 'pro' ? 'pro' : 'flash';
  let model = MODELS[tier];
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await call(model, entry, refs);
    if (res.status === 404 && model !== FALLBACK) {
      model = FALLBACK;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    const json = await res.json();
    if (!res.ok) return `${entry.id}: HTTP ${res.status} ${JSON.stringify(json.error?.message || json).slice(0, 300)}`;
    const parts = json.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData);
    if (!img) {
      const why = json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || 'no image part';
      return `${entry.id}: no image (${why})`;
    }
    await sharp(Buffer.from(img.inlineData.data, 'base64')).png().toFile(out);
    const note = parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
    fs.writeFileSync(
      path.join(RAW, `${entry.id}.md`),
      `# ${entry.id}\n\n- model: ${model}\n- aspect: ${entry.aspect || '1:1'}\n- size: ${entry.size || '1K'}\n- refs: ${refs.length}\n\n## Prompt\n\n${entry.prompt}\n` +
        (note ? `\n## Model note\n\n${note}\n` : ''),
    );
    const cost = PRICE[tier][entry.size || '1K'] ?? 0.134;
    fs.appendFileSync(SPEND_LOG, `${new Date().toISOString()}\t${entry.id}\t${model}\t${entry.size || '1K'}\t${cost}\n`);
    return `${entry.id}: ok (${model}${refs.length ? `, ${refs.length} refs` : ''}, ~$${cost})`;
  }
  return `${entry.id}: gave up after retries`;
}

// Small concurrency pool so a batch finishes quickly without tripping rate limits.
const queue = [...todo];
const workers = Array.from({ length: 4 }, async () => {
  while (queue.length) console.log(await generate(queue.shift()));
});
await Promise.all(workers);
