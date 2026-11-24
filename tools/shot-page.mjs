// Screenshot any dev-server page: node tools/shot-page.mjs /map.html out.png [width] [height]
import puppeteer from 'puppeteer-core';
const [path = '/', out = 'page.png', w = '1440', h = '1000'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h });
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(m.text()));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto((process.env.GAME_URL || 'http://localhost:5199') + path, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out, fullPage: true });
console.log(logs.join('\n') || 'no console errors');
await browser.close();
