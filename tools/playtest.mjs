// Headless playtest of the Banaras slice: starts the game, walks, teleports to key places,
// screenshots each and reports frame rate and console errors.
// Usage: npm run playtest  (dev server must be running)   Screens → playtest-output/
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] || new URL('../playtest-output', import.meta.url).pathname;
const URL_ = process.env.GAME_URL || 'http://localhost:5199/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1440,810'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });
const logs = [];
page.on('console', (m) => ['error', 'warn'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const t0 = Date.now();
await page.goto(URL_, { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction(() => window.game, { timeout: 120000 });
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await sleep(800);
await page.screenshot({ path: `${OUT}/b00_title.png` });
await page.keyboard.press('Enter');
await sleep(600);
await page.screenshot({ path: `${OUT}/b01_arrival_dialogue.png` });
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('Space');
  await sleep(120);
}
await sleep(500);

const fps = () =>
  page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t = performance.now();
        const tick = () => (++n, performance.now() - t < 1500 ? requestAnimationFrame(tick) : res(Math.round((n * 1000) / (performance.now() - t))));
        requestAnimationFrame(tick);
      }),
  );

const shot = async (name, tile) => {
  if (tile) {
    await page.evaluate(([x, y]) => {
      const g = window.game;
      const wx = x * 2;
      const wz = y * 2;
      g.player.root.position.set(wx, g.world.surfaceHeight(wx, wz), wz);
    }, tile);
  }
  await sleep(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  return fps();
};

const report = {};
report.start = await shot('b02_start');
await page.keyboard.down('KeyW');
await sleep(1500);
await page.keyboard.up('KeyW');
report.walked = await shot('b03_walked');
report.flowerStairs = await shot('b04_flower_stairs', [24.5, 26]);
report.chaiChowk = await shot('b05_chai_chowk', [24.5, 18.5]);
report.bazaar = await shot('b06_bazaar', [24.5, 10]);
report.natya = await shot('b07_natya', [36, 11.5]);
report.lampGali = await shot('b08_lamp_gali', [15.5, 7.5]);
report.stepwell = await shot('b09_stepwell', [10.5, 10.5]);
report.temple = await shot('b10_temple_chowk', [24.5, 3.5]);
report.rajaGhat = await shot('b11_raja_ghat', [44, 33.5]);
report.eastGali = await shot('b12_east_gali', [42.5, 12]);

// Talk to the lamplighter and light the shrine.
await page.evaluate(() => {
  const g = window.game;
  const p = g.lamplighter.root.position;
  g.player.root.position.set(p.x + 0.6, p.y, p.z + 1.2);
});
await sleep(400);
await page.keyboard.press('KeyE');
for (let i = 0; i < 30; i++) {
  const st = await page.evaluate(() => ({ choices: document.getElementById('choices').children.length, open: !document.getElementById('dialogue').hidden }));
  if (!st.open) break;
  if (st.choices) await page.keyboard.press('Digit1');
  else {
    await page.keyboard.press('Space');
    await sleep(60);
    await page.keyboard.press('Space');
  }
  await sleep(180);
}
await sleep(2500);
report.shrineLit = await shot('b13_shrine_lit');
const lit = await page.evaluate(() => window.game.dialogue.variables['shrine_lit']);

console.log(JSON.stringify({ fps: report, shrineLit: lit }, null, 1));
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
