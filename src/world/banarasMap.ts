/**
 * Level layout for the Banaras slice: the river and ghats at the bottom (south), a wall of
 * riverfront havelis and palaces, then a warren of narrow galis that open onto courtyards.
 *
 * This file is the single source of truth: the 2D plan (/map.html) draws from it, and the
 * 3D builder will read the same grid, zones and points of interest.
 *
 * Coordinates are tiles: x → east, y → south (row 0 is the top of the grid). One tile = 2 m.
 * The camera looks from the river towards the city (north), like a boat on the Ganga.
 */

export const TILE_METRES = 2;

export type TileKind = {
  name: string;
  walkable: boolean;
  /** Solid but see-through (jali screens): blocks movement, not sight. */
  seeThrough?: boolean;
};

export const LEGEND: Record<string, TileKind> = {
  '~': { name: 'River (Ganga)', walkable: false, seeThrough: true },
  _: { name: 'Wet bottom steps', walkable: true },
  '=': { name: 'Ghat steps', walkable: true },
  P: { name: 'Raised platform', walkable: true },
  '^': { name: 'Stairway up into the city', walkable: true },
  A: { name: 'Archway / covered passage', walkable: true },
  '.': { name: 'Gali (narrow lane)', walkable: true },
  ':': { name: 'Courtyard / chowk', walkable: true },
  '#': { name: 'Building', walkable: false },
  w: { name: 'Jali screen (see-through wall)', walkable: false, seeThrough: true },
  m: { name: 'Stall / loom', walkable: false },
  S: { name: 'Shrine, well or chhatri', walkable: false },
  T: { name: 'Great tree (banyan / peepal)', walkable: false },
  g: { name: 'Upper gallery (+4 m)', walkable: true },
  u: { name: 'Stair up to the gallery', walkable: true },
  '1': { name: 'Stepwell tier 1 (−1.5 m)', walkable: true },
  '2': { name: 'Stepwell tier 2 (−3 m)', walkable: true },
  '3': { name: 'Stepwell tier 3 (−4.5 m)', walkable: true },
  o: { name: 'Sacred pool (−6 m)', walkable: false, seeThrough: true },
};

/** Tiles that climb between levels: they may join floors up to 2.5 m apart. */
const STAIR_TILES = new Set(['^', 'u', 'A', '_']);
/** Floor heights (m above the river) for tiles whose level doesn't follow the ghat rows. */
const LEVELS: Record<string, number> = { g: 14, u: 12, '1': 8.5, '2': 7, '3': 5.5, o: 4 };

// prettier-ignore
export const GRID: string[] = [
  '####################################################', //  0
  '#gggggggggggg#######################################', //  1
  '#gTT::::::::u####:::::::::::::::####################', //  2
  '#gTT11111111:A...:::::::S:::::::............########', //  3
  '#g:122222221:####:::::::::::::::##########..########', //  4
  '#g:123333321:w#########...################..########', //  5
  '#g:123oSo321:w########m...m###############..########', //  6
  '#g:123333321:w............m###############.......S##', //  7
  '#g:122222221:#.#######m...m#####:::PP::::#..########', //  8
  '#g:111111111:#.#######m...m#####:::PP::::w..########', //  9
  '#g:::::::::::#.#######m...m#####:::::::::w..########', // 10
  '#::::::::::###.#######m........A:::::::::w..#::::::#', // 11
  '#########AA###.#######m...m#####:::::::::#..#:m:m:m#', // 12
  '######.........#######m...m###############..A::::::#', // 13
  '######.......#########m...m###############..#:m:m:m#', // 14
  '######..###############...######............#::::::#', // 15
  '##......###########:::::::::::############..########', // 16
  '######..###########:T:::::::S:############..S#######', // 17
  '######..####::::###:::::::::::..............########', // 18
  '######......::::...:::::::::::############..########', // 19
  '######..####::S:###:::::::::::############........##', // 20
  '######..###########:::::::::::############..########', // 21
  '######^^#############^^^^^^^##############AA########', // 22
  '######^^#############m^^^^^m##############AA########', // 23
  '######^^#############m^^^^^m##############AA########', // 24
  '######^^#############m^^^^^m##############AA########', // 25
  '######^^#############m^^^^^m##############AA########', // 26
  '######^^#############m^^^^^m##############AA########', // 27
  '######^^#############^^^^^^^##############AA########', // 28
  '==============##==================########AA########', // 29
  '==============##==================########AA########', // 30
  '==============##==================########AA########', // 31
  '==============##==================##================', // 32
  '=PPPPPPPPPPPP=##PPPPPPPPPPPPPPPPPP##================', // 33
  '=======================================S=======S====', // 34
  '====================================================', // 35
  '==================PP=PP=PP=PP=PP====================', // 36
  '==S==S==S==S======PP=PP=PP=PP=PP====================', // 37
  '____________________________________________________', // 38
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 39
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 40
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 41
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 42
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 43
];

export const WIDTH = GRID[0].length;
export const HEIGHT = GRID.length;

export type ZoneKind = 'river' | 'ghat' | 'stair' | 'landmark' | 'court' | 'gali';

export type Zone = {
  id: string;
  name: string;
  /** Short label drawn on the plan. */
  label: string;
  kind: ZoneKind;
  /** Inclusive tile rectangle [x0, y0, x1, y1]. */
  rect: [number, number, number, number];
  /** Where the plan draws the label, if not the centre of `rect`. */
  labelAt?: [number, number];
  description: string;
  /** Mood-board images (moodboards/images/…) this zone draws from. */
  refs?: string[];
};

export const ZONES: Zone[] = [
  { id: 'river', name: 'The Ganga', label: 'THE GANGA', kind: 'river', rect: [0, 39, 51, 43],
    description: 'Wide, slow river at dusk. Moored and drifting boats, floating leaf-cup diyas, sun glitter and haze.',
    refs: ['2026-11-24_04_varanasi_ghats.png'] },
  { id: 'dhobiGhat', name: 'Dhobi Ghat', label: 'Dhobi Ghat', kind: 'ghat', rect: [0, 29, 13, 38],
    description: 'The quiet working ghat: washermen beat laundry on stone slabs, saris dry on lines strung across the steps.' },
  { id: 'aartiGhat', name: 'Aarti Ghat', label: 'Aarti Ghat', kind: 'ghat', rect: [16, 29, 33, 38],
    description: 'The main ghat. Five priests perform the evening aarti on platforms at the water; the crowd fills the steps and the landing; bells, conch shells, smoke and marigolds.',
    refs: ['2026-11-24_05_ganga_aarti.png', '2026-11-24_04_varanasi_ghats.png'] },
  { id: 'rajaGhat', name: "Raja's Ghat", label: "Raja's Ghat", kind: 'ghat', rect: [34, 29, 51, 38],
    description: 'The palace rises straight off the steps. Sadhus sit under bamboo umbrellas beside two stone chhatris; boats tie up below.' },
  { id: 'havelis', name: 'Riverfront havelis', label: 'riverfront havelis', kind: 'landmark', rect: [0, 22, 20, 28], labelAt: [14, 25.5],
    description: 'Tall carved havelis form a wall along the top of the ghats, balconies looking out over the river.',
    refs: ['2026-11-24_02_jaisalmer_haveli_lane.png'] },
  { id: 'westStair', name: 'West Stair', label: 'West Stair', kind: 'stair', rect: [6, 22, 7, 28],
    description: 'A steep, narrow stair squeezed between havelis — the back way up from Dhobi Ghat.' },
  { id: 'flowerStairs', name: 'Flower Stairs', label: 'Flower Stairs', kind: 'stair', rect: [21, 22, 27, 28], labelAt: [24.5, 28.5],
    description: 'The grand stair up from Aarti Ghat, lined both sides with marigold and rose garland sellers.' },
  { id: 'ghatTemple', name: 'Ghat Temple', label: 'Ghat Temple', kind: 'landmark', rect: [29, 22, 33, 28],
    description: 'A shikhara temple perched over the aarti ghat; its bells answer the aarti below.' },
  { id: 'palace', name: "Raja's Palace", label: "RAJA'S PALACE", kind: 'landmark', rect: [36, 22, 51, 31], labelAt: [47.5, 26],
    description: 'An ornate, many-storeyed palace in the Simonetti mood: stacked balconies, domes and arches. A dark vaulted tunnel runs under it into the city.',
    refs: ['2026-11-24_01_simonetti_city.png'] },
  { id: 'chaiChowk', name: 'Chai Chowk', label: 'Chai Chowk', kind: 'court', rect: [19, 16, 29, 21],
    description: 'The square at the top of the Flower Stairs: a chai stall, cows, a peepal tree with a small shrine. From its edge you look back down over the ghats and the aarti.' },
  { id: 'bazaar', name: 'Bazaar Gali', label: 'BAZAAR GALI', kind: 'gali', rect: [22, 5, 26, 15], labelAt: [24.5, 13.5],
    description: 'The market lane: spices, brass, Banarasi silk, bangles, sweets. Stalls press in from both sides; the temple spire shows at the far end.',
    refs: ['2026-11-24_01_simonetti_city.png'] },
  { id: 'natya', name: 'Natya Haveli', label: 'Natya Haveli', kind: 'court', rect: [32, 8, 40, 12],
    description: 'A haveli courtyard where a Kathak dancer performs on a raised stage to tabla and sarangi; audience on carpets, onlookers in the jharokhas above.',
    refs: ['2026-11-24_02_jaisalmer_haveli_lane.png'] },
  { id: 'lampGali', name: 'Lamp Gali', label: 'Lamp Gali', kind: 'gali', rect: [14, 7, 21, 7],
    description: 'A 2 m-wide lane that dead-ends at a carved jali glowing with the diya light behind it — you see the gathering before you find the way in.' },
  { id: 'lamps', name: 'Courtyard of Lamps', label: 'COURTYARD OF LAMPS', kind: 'court', rect: [1, 1, 12, 11], labelAt: [6.5, 0.5],
    description: 'A sunken stepwell inside a walled courtyard: three terraces of steps go down to a black sacred pool with a lone shrine on an island. Thousands of diyas line every step, worshippers sit on every tier, and a colossal banyan in the corner hangs its roots down into the water. An arcaded gallery runs along the north and west sides at +4 m, where unseen voices chant; the south side is open so you look straight down into the well. Incense smoke fills the well and glows orange; the flames shimmer in the water.',
    refs: ['2026-11-24_03_diya_prayer_gathering.png'] },
  { id: 'westGali', name: 'West Gali', label: 'West Gali', kind: 'gali', rect: [6, 13, 14, 21],
    description: 'A crooked lane from the West Stair to the Courtyard of Lamps; doorways, laundry overhead, a goat.' },
  { id: 'wellChowk', name: 'Well Chowk', label: 'Well', kind: 'court', rect: [12, 18, 15, 20],
    description: 'A tiny square around an old well; women drawing water, children playing.' },
  { id: 'templeChowk', name: 'Temple Chowk', label: 'TEMPLE CHOWK', kind: 'court', rect: [17, 2, 31, 4],
    description: 'Forecourt of the Old Temple at the top of the city: hanging bells, a Nandi shrine, pilgrims. The end of the route.' },
  { id: 'oldTemple', name: 'The Old Temple', label: 'OLD TEMPLE', kind: 'landmark', rect: [19, 0, 29, 1],
    description: 'The tallest spire in the slice, visible from the bazaar and the ghats — the landmark that pulls the player uphill.' },
  { id: 'eastGali', name: 'East Gali', label: 'East Gali', kind: 'gali', rect: [42, 3, 43, 21],
    description: 'Long narrow lane from the palace tunnel to the temple: a shrine niche, a cow blocking half the lane, and a jali that looks into the Natya Haveli courtyard.' },
  { id: 'sweetGali', name: 'Sweet-shop Gali', label: 'Sweet-shop Gali', kind: 'gali', rect: [30, 18, 41, 18],
    description: 'Halwais frying jalebis in huge kadhais; links Chai Chowk to the East Gali so the lanes form a loop.' },
  { id: 'weavers', name: "Weavers' Court", label: "Weavers'", kind: 'court', rect: [45, 11, 50, 15],
    description: 'Handlooms weaving Banarasi silk; the clatter of looms carries down the East Gali.' },
  { id: 'bellShrine', name: 'Bell Shrine', label: 'Bells', kind: 'gali', rect: [44, 7, 49, 7],
    description: 'A dead-end lane ending at a small shrine hung with dozens of brass bells.' },
  { id: 'kiteGali', name: "Kite-makers' Gali", label: 'Kites', kind: 'gali', rect: [2, 16, 5, 16], labelAt: [3.5, 15.3],
    description: 'A dead-end lane hung with paper kites drying on strings; children test them from the rooftops.' },
  { id: 'brassGali', name: 'Brass-beaters\' Gali', label: 'Brass Gali', kind: 'gali', rect: [32, 15, 41, 15], labelAt: [34, 14.3],
    description: 'A thin lane ringing with hammers: brass pots and lamps beaten on doorsteps, sparks from a small forge.' },
  { id: 'dyersGali', name: "Dyers' Gali", label: 'Dyers', kind: 'gali', rect: [44, 20, 49, 20], labelAt: [48.5, 19.3],
    description: 'Freshly dyed cloth — indigo, madder, turmeric — hangs overhead in long strips; dye vats steam in doorways.' },
  { id: 'natyaHaveli', name: 'Natya Haveli (building)', label: '', kind: 'landmark', rect: [30, 6, 41, 14],
    description: 'The haveli wrapped around the dance courtyard; carved jharokhas on every floor.' },
  { id: 'lampsEnclosure', name: 'Courtyard of Lamps (walls)', label: '', kind: 'landmark', rect: [0, 0, 13, 12],
    description: 'The old temple-like enclosure around the stepwell.' },
  { id: 'tunnel', name: 'Palace Tunnel', label: 'tunnel', kind: 'stair', rect: [42, 22, 43, 31],
    description: "A dark vaulted passage climbing under the palace from Raja's Ghat into the East Gali." },
];

export type PoiKind = 'start' | 'goal' | 'activity' | 'glimpse' | 'vista' | 'shrine' | 'prop' | 'boat';

export type Poi = {
  id: string;
  name: string;
  kind: PoiKind;
  /** Tile coordinates (fractions allowed). */
  at: [number, number];
  /** For glimpses and vistas: what you see from here. */
  lookAt?: [number, number];
  note?: string;
};

export const POIS: Poi[] = [
  { id: 'start', name: 'Arrive by boat', kind: 'start', at: [24.5, 38.5], note: 'The story opens as your boat touches the bottom step at dusk, mid-aarti.' },
  { id: 'aarti', name: 'Evening aarti', kind: 'activity', at: [24.5, 36.5], note: 'Five priests raise tiered brass lamps in unison.' },
  { id: 'aartiCrowd', name: 'Crowd on the steps', kind: 'activity', at: [25, 31] },
  { id: 'dhobi', name: 'Dhobis at work', kind: 'activity', at: [6.5, 35.5] },
  { id: 'sadhus', name: 'Sadhus under umbrellas', kind: 'activity', at: [43.5, 34.5] },
  { id: 'flowers', name: 'Garland sellers', kind: 'activity', at: [24.5, 25] },
  { id: 'chai', name: 'Chai stall', kind: 'activity', at: [21.5, 19.5] },
  { id: 'riverView', name: 'View back over the aarti', kind: 'vista', at: [24.5, 21.5], lookAt: [24.5, 36.5] },
  { id: 'spireView', name: 'Temple spire at the end of the bazaar', kind: 'vista', at: [24.5, 15], lookAt: [24.5, 1] },
  { id: 'bazaar', name: 'Spice, brass & silk stalls', kind: 'activity', at: [24.5, 9.5] },
  { id: 'danceOpening', name: 'Side gali opens onto the dancers', kind: 'glimpse', at: [25.5, 11.5], lookAt: [35.5, 9] },
  { id: 'dance', name: 'Kathak in the courtyard', kind: 'activity', at: [35.5, 8.5], note: 'Tabla and sarangi; audience on carpets.' },
  { id: 'danceJali', name: 'Jali onto the dance courtyard', kind: 'glimpse', at: [42.5, 10], lookAt: [37, 10] },
  { id: 'lampJali', name: 'Jali glowing with diya light', kind: 'glimpse', at: [14.5, 7.5], lookAt: [8, 6] },
  { id: 'lampsGathering', name: 'Diyas on every tier', kind: 'activity', at: [7.5, 4.5], note: 'Worshippers seated in rows on each terrace, lamps on every step.' },
  { id: 'lampShrine', name: 'Island shrine in the sacred pool', kind: 'shrine', at: [7.5, 6.5] },
  { id: 'lampGallery', name: 'Chanters in the upper gallery', kind: 'activity', at: [5.5, 1.5] },
  { id: 'banyan', name: 'Banyan roots hanging into the well', kind: 'prop', at: [3, 3] },
  { id: 'kites', name: 'Kites drying on strings', kind: 'activity', at: [3.5, 16.5] },
  { id: 'brass', name: 'Brass beaten on doorsteps', kind: 'activity', at: [36.5, 15.5] },
  { id: 'dyers', name: 'Dyed cloth overhead', kind: 'activity', at: [46.5, 20.5] },
  { id: 'well', name: 'Women at the well', kind: 'activity', at: [14.5, 20.5] },
  { id: 'sweets', name: 'Jalebis frying', kind: 'activity', at: [39.5, 18.5] },
  { id: 'weaving', name: 'Handlooms', kind: 'activity', at: [47.5, 13] },
  { id: 'bells', name: 'Bell shrine', kind: 'shrine', at: [49.5, 7.5] },
  { id: 'niche', name: 'Shrine niche', kind: 'shrine', at: [44.5, 17.5] },
  { id: 'cow', name: 'Cow blocking the gali', kind: 'prop', at: [42.9, 14.5] },
  { id: 'temple', name: 'The Old Temple', kind: 'goal', at: [24.5, 2.5], note: 'End of the slice.' },
  { id: 'boat1', name: 'Boat', kind: 'boat', at: [9, 40.3] },
  { id: 'boat2', name: 'Boat', kind: 'boat', at: [19, 39.7] },
  { id: 'boat3', name: 'Your boat', kind: 'boat', at: [24.5, 39.6] },
  { id: 'boat4', name: 'Boat', kind: 'boat', at: [31, 40.6] },
  { id: 'boat5', name: 'Boat', kind: 'boat', at: [40, 39.8] },
  { id: 'boat6', name: 'Boat', kind: 'boat', at: [47, 41.2] },
];

/** Suggested first path through the slice (POI ids, in order). Side areas stay optional. */
export const ROUTE = ['start', 'aarti', 'flowers', 'chai', 'bazaar', 'danceOpening', 'dance', 'lampJali', 'lampsGathering', 'temple'];

// ---------------------------------------------------------------------------------------------
// Helpers shared by the plan and (later) the 3D builder
// ---------------------------------------------------------------------------------------------

export function tileAt(x: number, y: number): string {
  return GRID[Math.floor(y)]?.[Math.floor(x)] ?? '#';
}

export function isWalkable(x: number, y: number) {
  return LEGEND[tileAt(x, y)]?.walkable ?? false;
}

/** Floor height in metres above the river. Ghats climb ~0.65 m per tile; the city sits at +10 m. */
export function floorHeight(x: number, y: number): number {
  const t = tileAt(x, y);
  const row = Math.floor(y);
  if (t === '~') return 0;
  if (row >= 38) return 0.3;
  if (t === 'A' && row >= 22) return 4.85 + ((31 - Math.min(row, 31)) * (10 - 4.85)) / 9; // tunnel ramp
  if (t === 'P' && row >= 36) return 2.0; // aarti platforms: raised stone plinths at the water
  if (row >= 29) return 0.3 + (38 - row) * 0.65;
  if ((t === '^' || t === 'm') && row >= 22) return 6.15 + (29 - row) * 0.55; // stairs and the flower stalls on them
  return LEVELS[t] ?? 10;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Can you walk from one tile to its neighbour? Both walkable, and the floors close enough in height. */
export function canStep(ax: number, ay: number, bx: number, by: number) {
  if (!isWalkable(ax, ay) || !isWalkable(bx, by)) return false;
  const limit = STAIR_TILES.has(tileAt(ax, ay)) || STAIR_TILES.has(tileAt(bx, by)) ? 2.5 : 1.6;
  return Math.abs(floorHeight(ax, ay) - floorHeight(bx, by)) <= limit;
}

/** Shortest walkable tile path (4-connected), or null. */
export function findPath(from: [number, number], to: [number, number]): [number, number][] | null {
  const key = (x: number, y: number) => y * WIDTH + x;
  const [sx, sy] = from.map(Math.floor);
  const [tx, ty] = to.map(Math.floor);
  const prev = new Map<number, number>([[key(sx, sy), -1]]);
  const queue: [number, number][] = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === tx && y === ty) {
      const path: [number, number][] = [];
      for (let k = key(x, y); k !== -1; k = prev.get(k)!) path.unshift([k % WIDTH, Math.floor(k / WIDTH)]);
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT || prev.has(key(nx, ny)) || !canStep(x, y, nx, ny)) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

/** Every walkable tile reachable from a start tile. */
export function reachableFrom(start: [number, number]) {
  const seen = new Set<number>();
  const queue = [start.map(Math.floor) as [number, number]];
  seen.add(queue[0][1] * WIDTH + queue[0][0]);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * WIDTH + nx;
      if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT || seen.has(k) || !canStep(x, y, nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

export type MapCheck = { errors: string[]; warnings: string[]; walkableTiles: number; reachableTiles: number };

/** Structural checks: row lengths, unknown characters, and that every POI can be reached on foot. */
export function checkMap(): MapCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  GRID.forEach((row, y) => {
    if (row.length !== WIDTH) errors.push(`Row ${y} has ${row.length} tiles, expected ${WIDTH}`);
    for (const ch of row) if (!LEGEND[ch]) errors.push(`Row ${y} uses unknown tile '${ch}'`);
  });
  const start = POIS.find((p) => p.kind === 'start')!;
  const reach = reachableFrom(start.at);
  const reachable = (x: number, y: number) =>
    reach.has(Math.floor(y) * WIDTH + Math.floor(x)) || DIRS.some(([dx, dy]) => reach.has((Math.floor(y) + dy) * WIDTH + Math.floor(x) + dx));
  for (const p of POIS) {
    if (p.kind === 'boat') continue;
    if (!reachable(...p.at)) errors.push(`"${p.name}" cannot be reached on foot from the boat`);
  }
  for (const id of ROUTE) {
    const p = POIS.find((q) => q.id === id);
    if (!p) errors.push(`Route stop "${id}" is not a point of interest`);
    else if (!isWalkable(...p.at)) errors.push(`Route stop "${p.name}" is not on a walkable tile`);
  }
  let walkable = 0;
  GRID.forEach((row, y) => [...row].forEach((_, x) => (walkable += isWalkable(x, y) ? 1 : 0)));
  if (reach.size < walkable) warnings.push(`${walkable - reach.size} walkable tiles are cut off from the boat`);
  return { errors, warnings, walkableTiles: walkable, reachableTiles: reach.size };
}

// ---------------------------------------------------------------------------------------------
// Houses: every building tile outside the landmarks is split into individual houses, each with
// a door onto a lane. Deterministic — change HOUSE_SEED to reshuffle the whole city.
// ---------------------------------------------------------------------------------------------

export const HOUSE_SEED = 7;

export type HouseStyle = 'blue' | 'ochre' | 'sandstone' | 'pink' | 'white';

export type House = {
  id: number;
  tiles: [number, number][];
  /** Door tile and the direction it faces (towards the lane). */
  door: { x: number; y: number; dx: number; dy: number };
  storeys: number;
  style: HouseStyle;
  /** Chabutra: a raised stone stoop by the door where people sit. */
  stoop: boolean;
  /** Projecting carved balcony on the upper floor. */
  jharokha: boolean;
  /** Rooftop terrace with laundry, plants or kites. */
  terrace: boolean;
};

/** Zones whose buildings are single landmarks, not houses. */
const NOT_HOUSES = ['palace', 'ghatTemple', 'oldTemple', 'natyaHaveli', 'lampsEnclosure'];
const STYLES: HouseStyle[] = ['blue', 'ochre', 'sandstone', 'pink', 'white'];
const MAX_DEPTH = 5; // tiles a house reaches back from its frontage

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateHouses(seed = HOUSE_SEED) {
  const rand = mulberry32(seed);
  const owner = new Int32Array(WIDTH * HEIGHT).fill(-1);
  const landmarks = ZONES.filter((z) => NOT_HOUSES.includes(z.id));
  const inside = (z: Zone, x: number, y: number) => x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3];
  const isLot = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && GRID[y][x] === '#' && !landmarks.some((z) => inside(z, x, y));
  const opensOnto = (x: number, y: number) =>
    DIRS.find(([dx, dy]) => isWalkable(x + dx, y + dy) && !'gu'.includes(tileAt(x + dx, y + dy)));
  const idx = (x: number, y: number) => y * WIDTH + x;

  // 1. Cut the lane frontage into 3–6 tile house fronts.
  const fronts: [number, number][][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!isLot(x, y) || owner[idx(x, y)] >= 0 || !opensOnto(x, y)) continue;
      const id = fronts.length;
      const want = (y >= 22 ? 4 : 3) + Math.floor(rand() * 3); // wide, calm frontages
      const front: [number, number][] = [[x, y]];
      owner[idx(x, y)] = id;
      for (let i = 0; i < front.length && front.length < want; i++) {
        for (const [dx, dy] of DIRS) {
          const nx = front[i][0] + dx;
          const ny = front[i][1] + dy;
          if (front.length >= want || !isLot(nx, ny) || owner[idx(nx, ny)] >= 0 || !opensOnto(nx, ny)) continue;
          owner[idx(nx, ny)] = id;
          front.push([nx, ny]);
        }
      }
      fronts.push(front);
    }
  }

  // 2. Grow each house back into its block (all houses at once, nearest frontage wins).
  let ring: [number, number][] = fronts.flat();
  for (let depth = 1; depth < MAX_DEPTH && ring.length; depth++) {
    const next: [number, number][] = [];
    for (const [x, y] of ring) {
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isLot(nx, ny) || owner[idx(nx, ny)] >= 0) continue;
        owner[idx(nx, ny)] = owner[idx(x, y)];
        next.push([nx, ny]);
      }
    }
    ring = next;
  }

  // 3. Give each house its character.
  const houses: House[] = fronts.map((front, id) => {
    const [x, y] = front[Math.floor(front.length / 2)];
    const [dx, dy] = opensOnto(x, y)!;
    const tiles: [number, number][] = [];
    owner.forEach((o, i) => o === id && tiles.push([i % WIDTH, Math.floor(i / WIDTH)]));
    const riverfront = y >= 22;
    return {
      id,
      tiles,
      door: { x, y, dx, dy },
      storeys: 2 + Math.floor(rand() * 3) + (riverfront ? 1 : 0) + (tiles.length >= 10 ? 1 : 0),
      style: STYLES[Math.floor(rand() * STYLES.length)],
      stoop: rand() < 0.4,
      jharokha: rand() < 0.45,
      terrace: rand() < 0.5,
    };
  });
  return { houses, owner };
}
