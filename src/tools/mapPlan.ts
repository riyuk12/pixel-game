// 2D plan of the Banaras slice, drawn straight from src/world/banarasMap.ts.
import {
  GRID, WIDTH, HEIGHT, TILE_METRES, LEGEND, ZONES, POIS, ROUTE,
  checkMap, findPath, floorHeight, isWalkable, generateHouses, HOUSE_SEED, type Zone, type Poi, type HouseStyle,
} from '../world/banarasMap';

const { houses, owner } = generateHouses();
const ownerAt = (x: number, y: number) => (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT ? -1 : owner[y * WIDTH + x]);

const T = 16; // px per tile
const PAD = { left: 92, top: 28, right: 24, bottom: 44 };
const W = WIDTH * T + PAD.left + PAD.right;
const H = HEIGHT * T + PAD.top + PAD.bottom;
const WALK_SPEED = 2.6; // m/s, matches the game

const css = /* css */ `
  :root { --bg:#140e22; --panel:#1d1530; --line:#36284a; --ink:#f1e4c6; --dim:#a8987c; --brass:#c9963a; --saffron:#f0a92b; --ok:#8fc27a; --bad:#ff7a6a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 Inter, system-ui, sans-serif; }
  #plan { display:grid; grid-template-columns:minmax(0, 1fr) 380px; gap:20px; max-width:1360px; margin:0 auto; padding:20px 16px 48px; }
  @media (max-width: 1100px) { #plan { grid-template-columns:1fr; } }
  h1, h2, h3 { font-family:'Pixelify Sans', monospace; font-weight:600; margin:0; }
  h1 { font-size:28px; color:var(--saffron); }
  h2 { font-size:18px; color:var(--saffron); margin:22px 0 8px; }
  h3 { font-size:15px; color:var(--ink); }
  .sub { color:var(--dim); margin:2px 0 12px; }
  .mapwrap { background:#0f0a1a; border:1px solid var(--line); overflow:auto; }
  .mapwrap svg { display:block; width:100%; height:auto; min-width:640px; }
  .toggles { display:flex; flex-wrap:wrap; gap:14px; margin:10px 0 0; color:var(--dim); }
  .toggles label { display:flex; align-items:center; gap:6px; cursor:pointer; }
  .legend { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:4px 14px; margin-top:12px; color:var(--dim); font-size:13px; }
  .legend span.sw { display:inline-block; width:14px; height:14px; vertical-align:-2px; margin-right:6px; border:1px solid #00000066; }
  aside { min-width:0; }
  .check { border:1px solid var(--line); background:var(--panel); padding:10px 12px; }
  .check .ok { color:var(--ok); } .check .bad { color:var(--bad); }
  ol.route { margin:0; padding-left:22px; } ol.route li { margin:2px 0; }
  ol.route .z { color:var(--dim); }
  .zone { border-top:1px solid var(--line); padding:10px 0; }
  .zone p { margin:4px 0 0; color:#d8cbb0; font-size:13px; }
  .zone .refs { display:flex; gap:6px; margin-top:6px; }
  .zone .refs img { width:56px; height:56px; object-fit:cover; border:1px solid var(--line); }
  .notes li { margin:4px 0; color:#d8cbb0; }
  .kindtag { font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:.06em; margin-left:6px; }
  .hidden-route .route-layer, .hidden-labels .label-layer, .hidden-grid .grid-layer, .hidden-sight .sight-layer { display:none; }
`;

// --- colours -----------------------------------------------------------------------------------
const mix = (a: string, b: string, t: number) => {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const FLOOR: Record<string, string> = {
  '~': '#22506c', _: '#6c7774', P: '#ecd4a2', '^': '#c9a673', A: '#6e5240', '.': '#b38e66', ':': '#d6b98a',
  '#': '#33242b', w: '#33242b', m: '#b38e66', S: '#d6b98a', T: '#d6b98a',
  g: '#e7d2a6', u: '#c9a673', '1': '#a8875f', '2': '#8a6b4a', '3': '#6c5038', o: '#0f3036',
};
/** Roof colour per house style (plan view at dusk); taller houses drawn a little lighter. */
const HOUSE_ROOF: Record<HouseStyle, string> = { blue: '4a5e88', ochre: '8a6a3c', sandstone: '7c4a35', pink: '86506a', white: '7a746d' };
const HOUSE_NAME: Record<HouseStyle, string> = { blue: 'blue-washed plaster', ochre: 'ochre plaster', sandstone: 'golden sandstone', pink: 'rose plaster', white: 'whitewash' };
const LANDMARK_ROOF: Record<string, string> = { palace: '#4b2c3c', ghatTemple: '#5a3024', oldTemple: '#5a3024', havelis: '#3c2a2c' };
const KIND_LABEL: Record<Zone['kind'], string> = { river: '#9fd0ee', ghat: '#fff3d6', stair: '#fff3d6', landmark: '#e9c27a', court: '#f0a92b', gali: '#f6e7c8' };
const POI_COLOUR: Record<Poi['kind'], string> = {
  start: '#8fc27a', goal: '#f0a92b', activity: '#58c4b8', glimpse: '#c59cff', vista: '#ffd27a', shrine: '#ff8a4a', prop: '#cbb89a', boat: '#5b3a22',
};

function ghatColour(x: number, y: number) {
  const h = floorHeight(x, y);
  return mix('8f6f4c', 'dcc092', Math.min(1, h / 6.2));
}

function roofColour(x: number, y: number) {
  const zone = ZONES.find((z) => LANDMARK_ROOF[z.id] && x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3]);
  return zone ? LANDMARK_ROOF[zone.id] : FLOOR['#'];
}

// --- svg helpers -------------------------------------------------------------------------------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cx = (x: number) => PAD.left + x * T;
const cy = (y: number) => PAD.top + y * T;

function drawTiles() {
  let out = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const t = GRID[y][x];
      let fill = FLOOR[t];
      if (t === '=') fill = ghatColour(x, y);
      if (t === '#' || t === 'w') fill = roofColour(x, y);
      if (t === '#' && ownerAt(x, y) >= 0) continue; // drawn by drawHouses
      out += `<rect x="${cx(x)}" y="${cy(y)}" width="${T}" height="${T}" fill="${fill}"/>`;
      const mx = cx(x) + T / 2;
      const my = cy(y) + T / 2;
      if (t === '=' || t === '_') out += `<line x1="${cx(x)}" y1="${cy(y) + T - 1}" x2="${cx(x) + T}" y2="${cy(y) + T - 1}" stroke="#00000030"/>`;
      if (t === '^') out += `<path d="M${cx(x) + 3} ${my + 3} L${mx} ${my - 3} L${cx(x) + T - 3} ${my + 3}" fill="none" stroke="#6b4e30" stroke-width="1.5"/>`;
      if (t === 'A') out += `<path d="M${cx(x) + 3} ${cy(y) + T} V${my} Q${mx} ${cy(y) + 1} ${cx(x) + T - 3} ${my} V${cy(y) + T}" fill="none" stroke="#e2c08a" stroke-width="1.2" opacity=".75"/>`;
      if (t === 'P') out += `<rect x="${cx(x) + 0.5}" y="${cy(y) + 0.5}" width="${T - 1}" height="${T - 1}" fill="none" stroke="#a5824f" stroke-width="1"/>`;
      if (t === 'm') out += `<rect x="${cx(x) + 2}" y="${cy(y) + 2}" width="${T - 4}" height="${T - 4}" rx="2" fill="#e0962a" stroke="#7a4a12"/>`;
      if (t === 'S') out += `<rect x="${mx - 4.5}" y="${my - 4.5}" width="9" height="9" transform="rotate(45 ${mx} ${my})" fill="#e8742a" stroke="#5a2a10"/>`;
      if (t === 'T') out += `<circle cx="${mx}" cy="${my}" r="${T * 0.62}" fill="#3f6d34" stroke="#22401c" opacity=".95"/>`;
      if (t === 'w') for (const dy of [4, 8, 12]) out += `<circle cx="${mx}" cy="${cy(y) + dy}" r="1.6" fill="#f0c66a"/>`;
      if ('123'.includes(t)) for (let k = 0; k < 3; k++) out += `<circle cx="${cx(x) + 3 + ((x * 7 + y * 3 + k * 5) % 10)}" cy="${cy(y) + 3 + ((x * 3 + y * 7 + k * 4) % 10)}" r="1.2" fill="#ffd36a"/>`;
      if (t === 'g') out += `<path d="M${cx(x)} ${cy(y) + T}L${cx(x) + T} ${cy(y)}" stroke="#b99a66" stroke-width="1"/>`;
      if (t === 'u') out += `<path d="M${cx(x) + 3} ${my + 3} L${mx} ${my - 3} L${cx(x) + T - 3} ${my + 3}" fill="none" stroke="#6b4e30" stroke-width="1.5"/>`;
      if (t === 'o') out += `<circle cx="${mx}" cy="${my}" r="5" fill="#2c7a72" opacity=".35"/>`;
      if (t === '~' && (x + y * 3) % 7 === 0) out += `<path d="M${cx(x) + 2} ${my} q3 -3 6 0 t6 0" fill="none" stroke="#4d86ad" stroke-width="1"/>`;
    }
  }
  return out;
}

function drawHouses() {
  let out = '';
  for (const h of houses) {
    const fill = mix(HOUSE_ROOF[h.style], 'f1e4c6', Math.min(0.3, (h.storeys - 2) * 0.07));
    const traits = [h.stoop && 'stoop', h.jharokha && 'jharokha', h.terrace && 'roof terrace'].filter(Boolean).join(', ');
    out += `<g><title>House ${h.id + 1} · ${h.storeys} storeys · ${HOUSE_NAME[h.style]}${traits ? ' · ' + traits : ''}</title>`;
    for (const [x, y] of h.tiles) out += `<rect x="${cx(x)}" y="${cy(y)}" width="${T}" height="${T}" fill="${fill}"/>`;
    out += '</g>';
  }
  // Party walls between neighbouring plots.
  let d = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const o = ownerAt(x, y);
      if (GRID[y][x] !== '#') continue;
      if (x + 1 < WIDTH && GRID[y][x + 1] === '#' && ownerAt(x + 1, y) !== o) d += `M${cx(x + 1)} ${cy(y)}v${T}`;
      if (y + 1 < HEIGHT && GRID[y + 1][x] === '#' && ownerAt(x, y + 1) !== o) d += `M${cx(x)} ${cy(y + 1)}h${T}`;
    }
  }
  out += `<path d="${d}" stroke="#140b10" stroke-width="1" fill="none"/>`;
  // Doors (and stoops) on the lane side.
  for (const h of houses) {
    const { x, y, dx, dy } = h.door;
    const ex = cx(x + 0.5 + dx * 0.5);
    const ey = cy(y + 0.5 + dy * 0.5);
    const [w, hh] = dx ? [3, 7] : [7, 3];
    out += `<rect x="${ex - w / 2}" y="${ey - hh / 2}" width="${w}" height="${hh}" fill="#f3c76a"/>`;
    if (h.stoop) out += `<rect x="${ex + dx * 3 - (dx ? 1.5 : 5)}" y="${ey + dy * 3 - (dy ? 1.5 : 5)}" width="${dx ? 3 : 10}" height="${dy ? 3 : 10}" fill="#e9d6ac" opacity=".8"/>`;
  }
  return out;
}

/** Edges between walkable floors at different heights: stepwell tiers and the gallery's edge. */
function drawLevelEdges() {
  let steps = '';
  let gallery = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isWalkable(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= WIDTH || ny >= HEIGHT || (!isWalkable(nx, ny) && GRID[ny][nx] !== 'o')) continue;
        const dh = Math.abs(floorHeight(x, y) - floorHeight(nx, ny));
        const seg = dx ? `M${cx(nx)} ${cy(y)}v${T}` : `M${cx(x)} ${cy(ny)}h${T}`;
        const isGallery = (GRID[y][x] === 'g') !== (GRID[ny][nx] === 'g');
        if (isGallery && dh > 2) gallery += seg;
        else if (dh >= 1.2 && !'^A_'.includes(GRID[y][x]) && !'^A_'.includes(GRID[ny][nx])) steps += seg;
      }
    }
  }
  return `<path d="${steps}" stroke="#2a1a10" stroke-width="1.6" fill="none"/><path d="${gallery}" stroke="#f0c66a" stroke-width="1.6" stroke-dasharray="3 2" fill="none"/>`;
}

/** Wall lines wherever walkable ground meets a building (not the river). */
function drawWalls() {
  let d = '';
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && !isWalkable(x, y) && !'~o'.includes(GRID[y][x]);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isWalkable(x, y)) continue;
      if (solid(x, y - 1)) d += `M${cx(x)} ${cy(y)}h${T}`;
      if (solid(x, y + 1)) d += `M${cx(x)} ${cy(y + 1)}h${T}`;
      if (solid(x - 1, y)) d += `M${cx(x)} ${cy(y)}v${T}`;
      if (solid(x + 1, y)) d += `M${cx(x + 1)} ${cy(y)}v${T}`;
    }
  }
  return `<path d="${d}" stroke="#140b10" stroke-width="2" fill="none" stroke-linecap="square"/>`;
}

function drawGrid() {
  let d = '';
  for (let x = 0; x <= WIDTH; x += 1) d += `M${cx(x)} ${cy(0)}V${cy(HEIGHT)}`;
  for (let y = 0; y <= HEIGHT; y += 1) d += `M${cx(0)} ${cy(y)}H${cx(WIDTH)}`;
  let labels = '';
  for (let x = 0; x < WIDTH; x += 5) labels += `<text x="${cx(x) + T / 2}" y="${PAD.top - 8}" class="axis">${x}</text>`;
  for (let y = 0; y < HEIGHT; y += 5) labels += `<text x="${PAD.left - 6}" y="${cy(y) + T / 2 + 4}" class="axis" text-anchor="end">${y}</text>`;
  return `<g class="grid-layer"><path d="${d}" stroke="#ffffff12" stroke-width="1"/>${labels}</g>`;
}

function drawElevation() {
  const marks: [number, string][] = [[40.5, 'river 0 m'], [38, '+0.3 m'], [33, '+3.6 m'], [29, '+6.2 m'], [22, '+10 m'], [10, 'city +10 m']];
  return marks
    .map(([y, s]) => `<text x="${PAD.left - 30}" y="${cy(y) + T / 2 + 4}" class="elev" text-anchor="end">${s}</text>`)
    .join('');
}

function drawLabels() {
  let out = '';
  for (const z of ZONES) {
    if (!z.label) continue;
    const [x0, y0, x1, y1] = z.rect;
    const w = (x1 - x0 + 1) * T;
    const h = (y1 - y0 + 1) * T;
    const mx = z.labelAt ? cx(z.labelAt[0]) : cx(x0) + w / 2;
    const my = z.labelAt ? cy(z.labelAt[1]) : cy(y0) + h / 2;
    const vertical = w <= 2 * T && h > 4 * T;
    const size = z.kind === 'river' ? 20 : z.label === z.label.toUpperCase() ? 13 : 12;
    const rot = vertical ? ` transform="rotate(-90 ${mx} ${my})"` : '';
    out += `<text x="${mx}" y="${my + size / 3}" class="zlabel" fill="${KIND_LABEL[z.kind]}" font-size="${size}" text-anchor="middle"${rot}><title>${esc(z.name)}: ${esc(z.description)}</title>${esc(z.label)}</text>`;
  }
  return `<g class="label-layer">${out}</g>`;
}

function poiShape(p: Poi, n?: number) {
  const x = cx(p.at[0]);
  const y = cy(p.at[1]);
  const c = POI_COLOUR[p.kind];
  const tip = `<title>${esc(p.name)}${p.note ? ' — ' + esc(p.note) : ''}</title>`;
  if (n !== undefined) {
    return `<g>${tip}<circle cx="${x}" cy="${y}" r="9" fill="${p.kind === 'goal' ? c : '#f0a92b'}" stroke="#140e22" stroke-width="2"/><text x="${x}" y="${y + 4}" class="num" text-anchor="middle">${n}</text></g>`;
  }
  switch (p.kind) {
    case 'boat':
      return `<g>${tip}<path d="M${x - 11} ${y - 2} Q${x} ${y + 7} ${x + 11} ${y - 2} Z" fill="${c}" stroke="#2a1a10"/></g>`;
    case 'glimpse':
      return `<g>${tip}<ellipse cx="${x}" cy="${y}" rx="7" ry="4.5" fill="#1d1530" stroke="${c}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="2" fill="${c}"/></g>`;
    case 'vista':
      return `<g>${tip}<path d="M${x} ${y - 6} L${x + 6} ${y + 5} L${x - 6} ${y + 5} Z" fill="${c}" stroke="#140e22"/></g>`;
    case 'shrine':
      return `<g>${tip}<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="#140e22" stroke-width="1.5"/></g>`;
    case 'prop':
      return `<g>${tip}<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="${c}" stroke="#140e22"/></g>`;
    default:
      return `<g>${tip}<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#140e22" stroke-width="2"/></g>`;
  }
}

function drawSightLines() {
  let out = '';
  for (const p of POIS) {
    if (!p.lookAt) continue;
    const c = POI_COLOUR[p.kind];
    out += `<line x1="${cx(p.at[0])}" y1="${cy(p.at[1])}" x2="${cx(p.lookAt[0])}" y2="${cy(p.lookAt[1])}" stroke="${c}" stroke-width="1.6" stroke-dasharray="2 4" opacity=".9"/>`;
  }
  return `<g class="sight-layer">${out}</g>`;
}

function routeData() {
  const stops = ROUTE.map((id) => POIS.find((p) => p.id === id)!).filter(Boolean);
  const path: [number, number][] = [];
  for (let i = 1; i < stops.length; i++) {
    const leg = findPath(stops[i - 1].at, stops[i].at);
    if (leg) path.push(...(i === 1 ? leg : leg.slice(1)));
  }
  return { stops, path };
}

function drawRoute(path: [number, number][]) {
  const d = path.map(([x, y], i) => `${i ? 'L' : 'M'}${cx(x + 0.5)} ${cy(y + 0.5)}`).join('');
  return `<path d="${d}" fill="none" stroke="#140e22" stroke-width="6" stroke-linejoin="round" opacity=".55"/><path d="${d}" fill="none" stroke="#f0a92b" stroke-width="2.5" stroke-dasharray="7 5" stroke-linejoin="round"/>`;
}

function drawCompass() {
  const x = cx(WIDTH) - 18;
  const y = cy(0) + 28;
  return `<g><circle cx="${x}" cy="${y}" r="15" fill="#140e22cc" stroke="#c9963a"/><path d="M${x} ${y - 11} L${x + 5} ${y + 4} L${x} ${y + 1} L${x - 5} ${y + 4} Z" fill="#f0a92b"/><text x="${x}" y="${y + 13}" class="axis" text-anchor="middle" fill="#f1e4c6">N</text></g>
  <g><text x="${cx(WIDTH / 2)}" y="${H - 14}" class="cam" text-anchor="middle">▲ camera looks this way — from the river towards the city</text></g>
  <g><line x1="${cx(0)}" y1="${H - 30}" x2="${cx(5)}" y2="${H - 30}" stroke="#f1e4c6" stroke-width="2"/><text x="${cx(0)}" y="${H - 14}" class="axis" fill="#f1e4c6">10 m</text></g>`;
}

function buildSvg() {
  const { stops, path } = routeData();
  const routeIds = new Map(ROUTE.map((id, i) => [id, i + 1]));
  const pois = POIS.filter((p) => !routeIds.has(p.id)).map((p) => poiShape(p)).join('');
  const numbered = stops.map((p) => poiShape(p, routeIds.get(p.id))).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map plan of the Banaras slice">
    <style>
      .axis { font: 10px Inter, sans-serif; fill: #8a7c66; }
      .elev { font: 600 10px Inter, sans-serif; fill: #c9963a; }
      .cam { font: 12px Inter, sans-serif; fill: #a8987c; }
      .zlabel { font-family: 'Pixelify Sans', monospace; font-weight: 600; paint-order: stroke; stroke: #140e22; stroke-width: 3.5px; stroke-linejoin: round; letter-spacing: .03em; pointer-events: auto; }
      .num { font: 700 11px Inter, sans-serif; fill: #140e22; }
    </style>
    ${drawTiles()}${drawHouses()}${drawWalls()}${drawLevelEdges()}${drawGrid()}${drawElevation()}
    ${drawSightLines()}
    <g class="route-layer">${drawRoute(path)}</g>
    ${drawLabels()}
    ${pois}
    <g class="route-layer">${numbered}</g>
    ${drawCompass()}
  </svg>`;
  return { svg, stops, path };
}

/** North–south elevation profile along the main route column (x = 24). */
function profileSvg() {
  const w = 340;
  const h = 110;
  const pts: string[] = [];
  for (let y = HEIGHT - 1; y >= 0; y--) {
    const px = ((HEIGHT - 1 - y) / (HEIGHT - 1)) * (w - 20) + 10;
    const py = h - 18 - (floorHeight(24, y) / 11) * (h - 34);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const water = h - 18;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Elevation profile">
    <rect x="10" y="${water - 2}" width="${((4 / 43) * (w - 20)).toFixed(1)}" height="4" fill="#22506c"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="#f0a92b" stroke-width="2"/>
    <text x="10" y="${h - 4}" fill="#a8987c" font-size="10">river</text>
    <text x="${w / 2 - 60}" y="${h - 4}" fill="#a8987c" font-size="10">ghats → Flower Stairs</text>
    <text x="${w - 10}" y="${h - 4}" fill="#a8987c" font-size="10" text-anchor="end">city +10 m</text>
  </svg>`;
}

/** East–west section through the Courtyard of Lamps (row 6): gallery, street ring, three tiers, pool. */
function stepwellSectionSvg() {
  const row = 6;
  const x0 = 0;
  const x1 = 14;
  const w = 340;
  const h = 150;
  const sx = (x: number) => 12 + ((x - x0) / (x1 - x0 + 1)) * (w - 24);
  const sy = (m: number) => h - 22 - ((m - 2) / 13) * (h - 40);
  let bars = '';
  for (let x = x0; x <= x1; x++) {
    const t = GRID[row][x];
    const bx = sx(x);
    const bw = sx(x + 1) - bx;
    if (t === 'o') {
      bars += `<rect x="${bx}" y="${sy(4)}" width="${bw}" height="${sy(2) - sy(4)}" fill="#1d5a5a"/>`;
      continue;
    }
    const top = t === 'S' ? 4.6 : t === '#' || t === 'w' ? 15.5 : floorHeight(x, row);
    const col = t === '#' ? '#4a3540' : t === 'w' ? '#6b4a3a' : t === 'S' ? '#e8742a' : t === 'g' ? '#e7d2a6' : '#b89466';
    bars += `<rect x="${bx}" y="${sy(top)}" width="${bw - 0.5}" height="${sy(2) - sy(top)}" fill="${col}"/>`;
    if ('123'.includes(t)) bars += `<circle cx="${bx + bw / 2}" cy="${sy(top) - 2}" r="1.8" fill="#ffd36a"/>`;
  }
  // The west gallery is an upper floor over an arcade: draw its floor slab at +4 m.
  bars += `<rect x="${sx(1)}" y="${sy(14)}" width="${sx(2) - sx(1)}" height="3" fill="#e7d2a6"/>`;
  const marks: [number, string][] = [[14, 'gallery +4 m'], [10, 'street'], [5.5, 'tier 3'], [4, 'pool']];
  const labels = marks.map(([m, s]) => `<text x="${w - 4}" y="${sy(m) + 3}" fill="#a8987c" font-size="9" text-anchor="end">${s}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Section through the Courtyard of Lamps">${bars}${labels}
    <text x="12" y="${h - 6}" fill="#a8987c" font-size="10">west wall</text><text x="${sx(7.5)}" y="${h - 6}" fill="#a8987c" font-size="10" text-anchor="middle">island shrine</text><text x="${sx(13.5)}" y="${h - 6}" fill="#a8987c" font-size="10" text-anchor="middle">jali</text></svg>`;
}

function render() {
  const root = document.getElementById('plan')!;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const check = checkMap();
  const { svg, stops, path } = buildSvg();
  const metres = (path.length - 1) * TILE_METRES;
  const zoneOf = (p: Poi) => ZONES.find((z) => p.at[0] >= z.rect[0] && p.at[0] < z.rect[2] + 1 && p.at[1] >= z.rect[1] && p.at[1] < z.rect[3] + 1);

  const legend = Object.entries(LEGEND)
    .map(([ch, k]) => `<div><span class="sw" style="background:${ch === '=' ? '#c2a476' : FLOOR[ch]}"></span>${k.name}</div>`)
    .concat(
      (['activity', 'glimpse', 'vista', 'shrine', 'prop'] as const).map(
        (k) => `<div><span class="sw" style="background:${POI_COLOUR[k]};border-radius:50%"></span>${{ activity: 'Activity / crowd', glimpse: 'Glimpse — opening that shows an activity (dashed = sight line)', vista: 'Vista point', shrine: 'Shrine', prop: 'Obstacle / prop' }[k]}</div>`,
      ),
    )
    .join('');

  const styleCounts = Object.entries(
    houses.reduce<Record<string, number>>((acc, h) => ((acc[h.style] = (acc[h.style] ?? 0) + 1), acc), {}),
  )
    .map(([k, n]) => `<span style="white-space:nowrap"><span class="sw" style="display:inline-block;width:12px;height:12px;vertical-align:-1px;margin-right:4px;background:#${HOUSE_ROOF[k as HouseStyle]}"></span>${n} ${HOUSE_NAME[k as HouseStyle]}</span>`)
    .join(' · ');
  const storeys = houses.map((h) => h.storeys);
  const houseSummary = `<p class="sub" style="margin:0 0 6px">${houses.length} houses, ${Math.min(...storeys)}–${Math.max(...storeys)} storeys, every one with a door on a lane (yellow mark; pale bar = stoop). Generated from the grid with seed ${HOUSE_SEED}; hover a roof for its details.</p><div style="font-size:13px;color:#d8cbb0">${styleCounts}</div>`;

  const groups: [string, Zone['kind'][]][] = [
    ['Riverfront', ['river', 'ghat']],
    ['Ways up', ['stair']],
    ['Courtyards & squares', ['court']],
    ['Galis (lanes)', ['gali']],
    ['Landmarks', ['landmark']],
  ];
  const zonesHtml = groups
    .map(([title, kinds]) => {
      const items = ZONES.filter((z) => kinds.includes(z.kind))
        .map(
          (z) => `<div class="zone"><h3>${esc(z.name)}<span class="kindtag">${(z.rect[2] - z.rect[0] + 1) * TILE_METRES}×${(z.rect[3] - z.rect[1] + 1) * TILE_METRES} m</span></h3>
          <p>${esc(z.description)}</p>${z.refs ? `<div class="refs">${z.refs.map((r) => `<img src="/moodboards/images/${r}" alt="" title="${r}"/>`).join('')}</div>` : ''}</div>`,
        )
        .join('');
      return `<h2>${title}</h2>${items}`;
    })
    .join('');

  root.innerHTML = `
    <section>
      <h1>Banaras slice — map plan</h1>
      <p class="sub">${WIDTH * TILE_METRES} m × ${HEIGHT * TILE_METRES} m · 1 tile = ${TILE_METRES} m · hover anything for details · source: <code>src/world/banarasMap.ts</code></p>
      <div class="mapwrap" id="mapwrap">${svg}</div>
      <div class="toggles">
        <label><input type="checkbox" data-layer="route" checked> Route</label>
        <label><input type="checkbox" data-layer="sight" checked> Sight lines</label>
        <label><input type="checkbox" data-layer="labels" checked> Labels</label>
        <label><input type="checkbox" data-layer="grid" checked> Grid</label>
      </div>
      <div class="legend">${legend}</div>
    </section>
    <aside>
      <div class="check">
        ${check.errors.length ? `<div class="bad">✗ ${check.errors.length} problem(s):<br>${check.errors.map(esc).join('<br>')}</div>` : `<div class="ok">✓ Map checks pass</div>`}
        ${check.warnings.map((w) => `<div class="bad">! ${esc(w)}</div>`).join('')}
        <div>${check.reachableTiles} of ${check.walkableTiles} walkable tiles reachable from the boat · ${POIS.filter((p) => p.kind !== 'boat').length} points of interest</div>
        <div>Main route: ${stops.length} stops, ~${metres} m (~${Math.round(metres / WALK_SPEED)} s walking without stopping)</div>
      </div>
      <h2>Main route</h2>
      <ol class="route">${stops.map((p) => `<li>${esc(p.name)} <span class="z">· ${esc(zoneOf(p)?.name ?? '')}</span></li>`).join('')}</ol>
      <h2>Houses</h2>
      ${houseSummary}
      <h2>Courtyard of Lamps — section</h2>
      ${stepwellSectionSvg()}
      <h2>Elevation (along the Flower Stairs)</h2>
      ${profileSvg()}
      <h2>Design notes</h2>
      <ul class="notes">
        <li><b>Camera from the river.</b> Looking north, the ghats rise away from the camera and building fronts face it, like the view from a boat.</li>
        <li><b>Galis run mostly north–south</b> so their walls sit to the sides of the view. Buildings between the camera and the player will dither-fade out so narrow east–west lanes stay readable.</li>
        <li><b>Glimpses before arrivals.</b> Each big activity is seen first through an opening: the side gali off the bazaar, a jali on the East Gali, the glowing jali at the end of Lamp Gali.</li>
        <li><b>The Courtyard of Lamps is multistorey:</b> a stepwell sinks three tiers below the street to a sacred pool, and a gallery rises 4 m above it on the north and west sides (own stair in the north-east corner). You first see it through the jali at the end of Lamp Gali, then enter by the south arch.</li>
        <li><b>The temple spire</b> is visible from the ghats and straight up the bazaar, pulling the player uphill.</li>
        <li><b>A loop, not a corridor:</b> Chai Chowk → Bazaar → Temple Chowk → East Gali → Sweet-shop Gali → Chai Chowk, with the West Stair, Palace Tunnel, Weavers' Court and Bell Shrine as side paths.</li>
      </ul>
      ${zonesHtml}
    </aside>`;

  const wrap = document.getElementById('mapwrap')!;
  root.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((box) =>
    box.addEventListener('change', () => wrap.classList.toggle(`hidden-${box.dataset.layer}`, !box.checked)),
  );
}

render();
