// Plain map plan (no labels, route, grid or sight lines) for use as an image-generation layout reference.
import puppeteer from 'puppeteer-core';
const out = process.argv[2] || 'playtest-output/map_clean.png';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await page.goto((process.env.GAME_URL || 'http://localhost:5199') + '/map.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  const wrap = document.getElementById('mapwrap');
  for (const l of ['route', 'labels', 'grid', 'sight']) wrap.classList.add(`hidden-${l}`);
  wrap.querySelectorAll('text').forEach((t) => (t.style.display = 'none'));
  wrap.querySelectorAll('circle, ellipse').forEach((c) => c.getAttribute('r') !== '1.2' && c.getAttribute('fill') !== '#3f6d34' && c.getAttribute('fill') !== '#2c7a72' && (c.style.display = 'none'));
});
const svg = await page.$('#mapwrap svg');
await svg.screenshot({ path: out });
await browser.close();
console.log('saved', out);
