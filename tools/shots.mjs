// Quick screenshots at chosen tiles and camera turns.
// Usage: node tools/shots.mjs name:x,y[:yawDeg[:pitchDeg[:zoom]]] ...   → playtest-output/<name>.png
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
await page.goto(process.env.GAME_URL || 'http://localhost:5199/', { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction(() => window.game, { timeout: 120000 });
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 400));
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 100));
}
for (const spec of process.argv.slice(2)) {
  const [name, xy, yaw = '0', pitch = '34', dist = '20'] = spec.split(':');
  const [x, y] = xy.split(',').map(Number);
  await page.evaluate(
    ([x, y, yaw, pitch, dist]) => {
      const g = window.game;
      g.player.root.position.set(x * 2, g.world.surfaceHeight(x * 2, y * 2), y * 2);
      const o = { yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180, zoom: dist };
      Object.assign(g.view.orbit, o);
      Object.assign(g.view.goal, o);
    },
    [x, y, +yaw, +pitch, +dist],
  );
  await new Promise((r) => setTimeout(r, 1300));
  await page.screenshot({ path: `playtest-output/${name}.png` });
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
