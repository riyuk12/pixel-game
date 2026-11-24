// Debug: which buildings does the cutaway think block the player at a tile + camera yaw?
// Usage: node tools/debug-occlusion.mjs x y yawDeg
import puppeteer from 'puppeteer-core';
const [x, y, yaw] = process.argv.slice(2).map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.game, { timeout: 60000 });
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 300));
for (let i = 0; i < 8; i++) await page.keyboard.press('Space');
const out = await page.evaluate(([x, y, yaw]) => new Promise((res) => {
  const g = window.game;
  g.player.root.position.set(x * 2, g.world.surfaceHeight(x * 2, y * 2), y * 2);
  Object.assign(g.view.orbit, { yaw: (yaw * Math.PI) / 180 });
  Object.assign(g.view.goal, { yaw: (yaw * Math.PI) / 180 });
  setTimeout(() => {
    const items = g.occlusion.pieces || [];
    const cut = Array.from(g.occlusion.cellValue).map((v, i) => [v, i]).filter(([v]) => v > 0).map(([, i]) => [i % 52, Math.floor(i / 52)]);
    const first = items.find((it) => it.o.fade > 0);
    const meshes = [];
    first?.o.object.traverse((o) => o.isMesh && meshes.push(o));
    const m = meshes[0]?.material;
    const props = m && g.view.renderer.properties.get(m);
    res({ player: g.player.root.position.toArray().map((v) => +v.toFixed(1)), cut, total: items.length,
      matType: m?.type, cutaway: m?.userData?.cutaway, onValue: m?.userData?.fade?.value,
      uniformKeys: props?.uniforms ? Object.keys(props.uniforms).filter((k) => k.startsWith('uCut')) : 'no uniforms',
      sameObject: props?.uniforms?.uCutOn === m?.userData?.fade, fadesSame: first?.o.fades.includes(m?.userData?.fade),
      centerHit: (() => {
        const T = g.player.root.position.constructor;
        const rc = new (g.occlusion.ray.constructor)();
        const cam = g.view.camera;
        // Orthographic: cast along the view direction from the camera through the player.
        const p = g.player.root.position.clone(); p.y += 1.0;
        const back = new T(0, 0, 1).applyQuaternion(cam.quaternion);
        rc.set(p.clone().addScaledVector(back, 300), back.clone().negate());
        const hits = rc.intersectObjects(g.scene.children, true).filter((h) => h.object.visible && h.object.isMesh);
        return hits.slice(0, 4).map((h) => {
          let o = h.object; while (o.parent && o.parent !== g.scene) o = o.parent;
          const occ = items.findIndex((it) => it.o.object === o);
          const at = h.object.geometry.attributes.aCutTile;
          const cell = at ? [at.getX(h.face.a), at.getY(h.face.a)] : null;
          const ci = cell ? cell[1] * 52 + cell[0] : -1;
          return { dist: +h.distance.toFixed(1), point: h.point.toArray().map((v) => +v.toFixed(1)), name: h.object.name,
            cell, cellOfPoint: [Math.floor(h.point.x / 2), Math.floor(h.point.z / 2)], cut: ci >= 0 ? +g.occlusion.cellValue[ci].toFixed(2) : null,
            top: ci >= 0 ? +g.cellTops[ci].toFixed(1) : null, marked: ci >= 0 ? g.occlusion.hit[ci] : null };
        });
      })(),
      shader: (() => {
        const prog = props?.currentProgram;
        if (!prog) return 'no program';
        const gl = g.view.renderer.getContext();
        const shaders = gl.getAttachedShaders(prog.program);
        const src = shaders.map((sh) => gl.getShaderSource(sh));
        const frag = src.find((t) => t.includes('gl_FragColor') || t.includes('pc_fragColor')) || '';
        const vert = src.find((t) => t !== frag) || '';
        const i = frag.indexOf('uCutOn > 0.0');
        return { fragHasCut: i >= 0, vertHasWorld: vert.includes('vCutWorld ='), fragSnippet: frag.slice(Math.max(0, i - 40), i + 420) };
      })() });
  }, 1200);
}), [x, y, yaw]);
console.log(JSON.stringify({ cut: out.cut, centerHit: out.centerHit?.slice(0, 2) }));
await page.screenshot({ path: 'playtest-output/debug_occlusion.png' });
await page.evaluate(() => { window.__w = true; });
await browser.close();
