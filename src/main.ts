import './style.css';
import * as THREE from 'three';
import { PixelRenderer, snapInFrame } from './render/pixelRenderer';
import { POIS, TILE_METRES as TS, type Poi } from './world/banarasMap';
import { buildBanaras } from './world/banaras';
import { CELL_TOPS } from './world/banaras/buildings';
import { buildCrowd, buildWalkers, updateWalkers } from './world/banaras/crowd';
import { buildMagic } from './world/banaras/magic';
import { toonify, SHADER_TIME } from './world/banaras/materials';
import { Occlusion } from './world/banaras/occlusion';
import { spawnCharacter, addTurban, addHandLamp } from './world/characters';
import type { Lantern } from './world/kit';
import { Dialogue } from './story/dialogue';
import storySource from './story/story.ink?raw';

const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 2.6;
const RUN_SPEED = 5.4;

type Interactable = { pos: THREE.Vector3; radius: number; prompt: string; knot: string };

const VERB: Partial<Record<Poi['kind'], string>> = {
  activity: 'Watch',
  glimpse: 'Look through',
  vista: 'Take in',
  shrine: 'Visit',
  goal: 'Enter',
  prop: 'Look at',
};

async function main() {
  const scene = new THREE.Scene();
  const view = new PixelRenderer(document.getElementById('app')!, scene, { yaw: 0, pitch: THREE.MathUtils.degToRad(34), zoom: 20 });
  const world = buildBanaras(scene, view.renderer);
  const tileToWorld = (t: [number, number]) => {
    const x = t[0] * TS;
    const z = t[1] * TS;
    return new THREE.Vector3(x, world.surfaceHeight(x, z), z);
  };

  // --- Characters -----------------------------------------------------------------------------
  const [player, lamplighter, crowd, walkers] = await Promise.all([
    spawnCharacter('Rogue_Hooded', 'default', 2.1),
    spawnCharacter('Mage', 'default', 2.05),
    buildCrowd(scene),
    buildWalkers(scene),
  ]);
  const magic = buildMagic(scene, view.camera, world.shrinePos);
  const start = POIS.find((p) => p.kind === 'start')!;
  player.root.position.copy(tileToWorld(start.at));
  player.root.rotation.y = Math.PI;
  player.play('Idle');
  scene.add(player.root);

  const lampOfLamplighter: Lantern[] = [];
  addTurban(lamplighter);
  addHandLamp(lamplighter, lampOfLamplighter);
  lamplighter.root.position.copy(tileToWorld([10.4, 9.5]));
  lamplighter.root.rotation.y = Math.PI;
  lamplighter.play('Sit_Floor_Idle');
  scene.add(lamplighter.root);
  lamplighter.mixer.addEventListener('finished', () => lamplighter.play('Idle', { fade: 0.4 }));

  // --- Things to inspect: every point of interest that has a knot in the story ----------------
  const knots = new Set([...storySource.matchAll(/^=== (\w+) ===/gm)].map((m) => m[1]));
  const interactables: Interactable[] = POIS.filter((p) => knots.has(p.id) && VERB[p.kind]).map((p) => ({
    pos: tileToWorld(p.at),
    radius: p.kind === 'glimpse' || p.kind === 'vista' ? 2.2 : 3.2,
    prompt: `${VERB[p.kind]}: ${p.name}`,
    knot: p.id,
  }));
  interactables.push({ pos: lamplighter.root.position, radius: 2.4, prompt: 'Talk to the old lamplighter', knot: 'lamplighter' });

  // --- Story events -----------------------------------------------------------------------------
  let clock = 0;
  let surge = 0;
  const tags: Record<string, () => void> = {
    light_shrine: () => {
      world.props.islandLamp.target = 1;
      world.props.shrineLight.target = 1;
      for (const l of lampOfLamplighter) l.target = 1;
      surge = 1;
      magic.lightShrine();
      lamplighter.play('Cheer', { once: true });
    },
  };

  let state: 'title' | 'play' | 'dialogue' = 'title';
  const dialogue = new Dialogue(storySource, (tag) => tags[tag]?.(), () => (state = 'play'));
  const talk = (knot: string) => {
    state = 'dialogue';
    player.play('Idle');
    dialogue.start(knot);
  };

  // --- Input ----------------------------------------------------------------------------------
  const keys = new Set<string>();
  const title = document.getElementById('title')!;
  const prompt = document.getElementById('prompt')!;
  const hud = document.getElementById('hud')!;
  let nearby: Interactable | undefined;

  const startGame = () => {
    if (state !== 'title') return;
    title.classList.add('hidden');
    hud.hidden = false;
    talk('arrival');
  };
  title.addEventListener('click', startGame);
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) return startGame();
    if (e.code === 'KeyR') view.reset();
    if (!e.repeat && e.code === 'KeyQ') view.turn(1);
    if (!e.repeat && e.code === 'KeyE') view.turn(-1);
    if (state === 'dialogue') {
      if (['KeyF', 'Space', 'Enter'].includes(e.code)) dialogue.advance();
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit) dialogue.choose(Number(digit[1]) - 1);
      return;
    }
    if (state === 'play' && (e.code === 'KeyF' || e.code === 'Enter') && nearby) talk(nearby.knot);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // Camera: Q/E or a horizontal drag turns 45°, a vertical drag tilts, the wheel zooms, R resets.
  // Every view is a fixed step so the pixel pattern never crawls.
  const app = document.getElementById('app')!;
  const DRAG_STEP = 70; // screen pixels of drag per camera step
  let drag: { x: number; y: number } | undefined;
  app.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    app.setPointerCapture(e.pointerId);
  });
  app.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) >= DRAG_STEP) {
      view.turn(dx > 0 ? -1 : 1);
      drag.x = e.clientX;
    }
    if (Math.abs(dy) >= DRAG_STEP) {
      view.tilt(dy > 0 ? 1 : -1);
      drag.y = e.clientY;
    }
  });
  app.addEventListener('pointerup', () => (drag = undefined));
  app.addEventListener('contextmenu', (e) => e.preventDefault());
  let wheel = 0;
  addEventListener(
    'wheel',
    (e) => {
      wheel += e.deltaY;
      if (Math.abs(wheel) >= 120) {
        view.zoomStep(wheel > 0 ? -1 : 1);
        wheel = 0;
      }
    },
    { passive: true },
  );

  // --- Movement -------------------------------------------------------------------------------
  const move = new THREE.Vector3();
  const tryMove = (pos: THREE.Vector3, dx: number, dz: number) => {
    const r = PLAYER_RADIUS;
    const ok = (x: number, z: number) => world.canMove(pos.x, pos.z, x, z);
    if (dx) {
      const nx = pos.x + dx;
      const lead = nx + Math.sign(dx) * r;
      if (ok(lead, pos.z) && ok(lead, pos.z + r * 0.7) && ok(lead, pos.z - r * 0.7)) pos.x = nx;
    }
    if (dz) {
      const nz = pos.z + dz;
      const lead = nz + Math.sign(dz) * r;
      if (ok(pos.x, lead) && ok(pos.x + r * 0.7, lead) && ok(pos.x - r * 0.7, lead)) pos.z = nz;
    }
  };
  const updatePlayer = (dt: number) => {
    const ix = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const iz = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    move.copy(view.screenForward).multiplyScalar(iz).addScaledVector(view.screenRight, ix);
    const moving = move.lengthSq() > 0;
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const pos = player.root.position;
    if (moving) {
      move.normalize().multiplyScalar((running ? RUN_SPEED : WALK_SPEED) * dt);
      tryMove(pos, move.x, move.z);
      const away = pos.clone().sub(lamplighter.root.position).setY(0);
      if (away.length() < 0.8) pos.add(away.setLength(0.8 - away.length()));
      player.face(move, dt);
    }
    pos.y += (world.surfaceHeight(pos.x, pos.z) - pos.y) * Math.min(1, dt * 16);
    player.play(moving ? (running ? 'Running_A' : 'Walking_A') : 'Idle', { fade: 0.15 });
  };

  // --- Lights ---------------------------------------------------------------------------------
  const sunDir = new THREE.Vector3(-1, 0.42, 0.28).normalize();
  const sunQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(sunDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
  const shadowCam = world.sun.shadow.camera;
  const shadowStep = (shadowCam.right - shadowCam.left) / world.sun.shadow.mapSize.x;
  const sunTarget = new THREE.Vector3();
  const updateLights = (dt: number) => {
    snapInFrame(player.root.position, sunQuat, shadowStep, sunTarget);
    world.sun.target.position.copy(sunTarget);
    world.sun.position.copy(sunTarget).addScaledVector(sunDir, 140);
    surge = Math.max(0, surge - dt * 0.35);
    for (const f of world.props.lamps) {
      f.on += (f.target - f.on) * Math.min(1, dt * 2.5);
      const flicker = 1 + 0.08 * Math.sin(clock * 11 + f.seed) + 0.05 * Math.sin(clock * 27 + f.seed * 3);
      f.light.intensity = f.base * f.on * flicker * (1 + surge * 0.8);
    }
    for (const l of lampOfLamplighter) {
      l.lit += (l.target - l.lit) * Math.min(1, dt * 3);
      l.light.intensity = l.lit * 6;
      l.glass.emissiveIntensity = l.lit * 6;
    }
    world.props.diyas.update(clock);
    world.props.boats.forEach((b, i) => {
      b.obj.position.y = 0.12 + Math.sin(clock * 1.1 + i) * 0.06;
      b.obj.rotation.z = Math.sin(clock * 0.9 + i * 2) * 0.035;
      if (b.speed) {
        b.obj.position.x += b.speed * dt;
        if (b.obj.position.x > 150) b.obj.position.x = -40;
        if (b.obj.position.x < -40) b.obj.position.x = 150;
      }
    });
  };

  // --- Main loop ------------------------------------------------------------------------------
  toonify(scene);
  const occlusion = new Occlusion(view, world.occluders);
  const timer = new THREE.Timer();
  const lookAt = new THREE.Vector3();
  const toPlayer = new THREE.Vector3();
  const frame = (now: number) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    clock += dt;
    SHADER_TIME.value = clock;

    if (state === 'play') updatePlayer(dt);
    toPlayer.subVectors(player.root.position, lamplighter.root.position).setY(0);
    if (state === 'dialogue' && dialogueWithLamplighter()) player.face(toPlayer.clone().negate(), dt, 6);

    nearby =
      state === 'play'
        ? interactables
            .filter((it) => it.pos.distanceTo(player.root.position) < it.radius)
            .sort((a, b) => a.pos.distanceTo(player.root.position) - b.pos.distanceTo(player.root.position))[0]
        : undefined;
    prompt.hidden = !nearby;
    if (nearby) prompt.textContent = `[F] ${nearby.prompt}`;

    player.update(dt);
    lamplighter.update(dt);
    for (const m of crowd) {
      m.c.update(dt);
      if (m.spin) m.c.root.rotation.y += dt * 4;
    }
    updateWalkers(walkers, dt);
    updateLights(dt);
    magic.update(clock, dt, view.orbit.yaw);
    dialogue.update(dt);

    lookAt.copy(player.root.position).add(new THREE.Vector3(0, 1, 0));
    view.follow(lookAt, dt);
    occlusion.update(player.root.position, dt);
    view.render();
    requestAnimationFrame(frame);
  };
  const dialogueWithLamplighter = () => player.root.position.distanceTo(lamplighter.root.position) < 3;
  requestAnimationFrame(frame);
  document.getElementById('loading')?.remove();

  Object.assign(window, { game: { scene, view, world, player, lamplighter, crowd, dialogue, occlusion, cellTops: CELL_TOPS } });
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = `Failed to start: ${err.message}`;
});
