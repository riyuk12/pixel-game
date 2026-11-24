// Quick health check: does the game start, how fast, any errors? (node tools/health.mjs)
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
page.on('requestfailed', (r) => logs.push('requestfailed: ' + r.url()));
const t0 = Date.now();
try {
  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForFunction(() => window.game, { timeout: 40000 });
  await new Promise((r) => setTimeout(r, 4000)); // let shaders compile and the scene settle
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const tick = () => (++n, performance.now() - t < 1500 ? requestAnimationFrame(tick) : res(Math.round((n * 1000) / (performance.now() - t)))); requestAnimationFrame(tick); }));
  console.log(`started in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${fps} fps`);
} catch (e) {
  console.log('FAILED: ' + e.message.split('\n')[0]);
}
console.log(logs.slice(0, 15).join('\n') || 'no errors');
await browser.close();
