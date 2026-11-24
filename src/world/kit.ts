import * as THREE from 'three';

// ---------------------------------------------------------------------------------------------
// Textures & materials. Every surface texture is Gemini-generated (see art-src/prompts.json).
// ---------------------------------------------------------------------------------------------

const loader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();

export function texture(name: string, repeatX = 1, repeatY = 1) {
  const key = `${name}@${repeatX}x${repeatY}`;
  let t = textures.get(key);
  if (!t) {
    t = loader.load(`/textures/${name}.png`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.repeat.set(repeatX, repeatY);
    textures.set(key, t);
  }
  return t;
}

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.92, ...p });

export const M = {
  sandstone: std({ map: texture('tex_sandstone') }),
  plasterBlue: std({ map: texture('tex_plaster_blue') }),
  plasterOchre: std({ map: texture('tex_plaster_ochre') }),
  tiles: std({ map: texture('tex_tiles'), roughness: 0.35, envMapIntensity: 0.8 }),
  tileBand: std({ map: texture('tex_tiles', 6, 1), roughness: 0.35, envMapIntensity: 0.8 }),
  ground: std({ map: texture('tex_ground') }),
  paving: std({ map: texture('tex_paving') }),
  fabric: std({ map: texture('tex_fabric'), side: THREE.DoubleSide }),
  carpet: std({ map: texture('tex_carpet') }),
  door: std({ map: texture('tex_door') }),
  jali: std({ map: texture('tex_jali'), emissiveMap: texture('tex_jali'), emissive: 0xffffff, emissiveIntensity: 0 }),
  whitewash: std({ color: 0xeee4d2 }),
  brass: std({ color: 0xd19a3c, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 }),
  wood: std({ color: 0x5b3a22 }),
  palmTrunk: std({ color: 0x6e4c30 }),
  palmLeaf: std({ color: 0x3f6a30, side: THREE.DoubleSide }),
  glass: std({ color: 0x3a2a1a, emissive: 0xffa040, emissiveIntensity: 0 }),
  clay: std({ color: 0xa4583a }),
};

export const SPICES = [0xe8a020, 0xb8261c, 0x6f8a2a, 0xd9692a, 0x7a3b1c].map((c) => std({ color: c }));

/**
 * Replaces a geometry's UVs with world-scale planar UVs picked per face from its normal,
 * so textures keep the same texel density on every wall regardless of its size.
 */
export function worldUV(geo: THREE.BufferGeometry, tile: number) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) [u, v] = [pos.getX(i), pos.getZ(i)];
    else if (ax >= az) [u, v] = [pos.getZ(i), pos.getY(i)];
    else [u, v] = [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** A box sitting on y=0 (its base at the origin), textured at world scale. */
export function box(w: number, h: number, d: number, mat: THREE.Material, tile = 4) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  return mesh(worldUV(geo, tile), mat);
}

// ---------------------------------------------------------------------------------------------
// Indo-Persian architectural pieces
// ---------------------------------------------------------------------------------------------

/** Onion dome (Mughal) via a lathe profile. Base sits at y=0. */
export function onionDome(radius: number, height: number, mat: THREE.Material = M.whitewash) {
  const profile: [number, number][] = [
    [0.82, 0], [0.96, 0.08], [1.0, 0.22], [0.97, 0.36], [0.85, 0.5],
    [0.64, 0.64], [0.4, 0.77], [0.2, 0.88], [0.07, 0.96], [0.0, 1.0],
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r * radius, y * height));
  const g = new THREE.Group();
  g.add(mesh(new THREE.LatheGeometry(pts, 20), mat));
  // Brass finial: stacked spheres and a spike.
  const fin = new THREE.Group();
  fin.add(mesh(new THREE.SphereGeometry(radius * 0.09, 8, 6), M.brass));
  const s2 = mesh(new THREE.SphereGeometry(radius * 0.06, 8, 6), M.brass);
  s2.position.y = radius * 0.13;
  fin.add(s2);
  const spike = mesh(new THREE.ConeGeometry(radius * 0.03, radius * 0.35, 6), M.brass);
  spike.position.y = radius * 0.32;
  fin.add(spike);
  fin.position.y = height;
  g.add(fin);
  return g;
}

/**
 * A wall slab pierced by a two-centred pointed arch — the signature Islamic / Mughal arch.
 * Centred on x=0, base at y=0, extruded along +z by `depth`.
 */
export function archWall(w: number, h: number, depth: number, open: number, spring: number, mat: THREE.Material, tile = 4) {
  // The opening reaches the ground, so it is traced as a notch in the outline rather than a hole
  // (a hole touching the outer edge breaks triangulation and fills the arch in).
  const a = open / 2;
  const c = a * 0.35; // centre offset: larger = pointier arch
  const R = a + c;
  const apexAngle = Math.acos(c / R);
  // Keep the apex below the top of the wall, or the outline crosses itself.
  spring = Math.min(spring, h - Math.sqrt(R * R - c * c) - 0.25);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(-a, 0);
  shape.lineTo(-a, spring);
  shape.absarc(c, spring, R, Math.PI, Math.PI - apexAngle, true);
  shape.absarc(-c, spring, R, apexAngle, 0, true);
  shape.lineTo(a, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return mesh(worldUV(geo, tile), mat);
}

/** Small domed pavilion used on rooftops (chhatri). */
export function chhatri(size: number) {
  const g = new THREE.Group();
  const postH = size * 1.1;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.08, postH, 6), M.sandstone);
    p.position.set((x * size) / 2.4, postH / 2, (z * size) / 2.4);
    g.add(p);
  }
  const slab = box(size, size * 0.12, size, M.sandstone);
  slab.position.y = postH;
  g.add(slab);
  const dome = onionDome(size * 0.45, size * 0.75);
  dome.position.y = postH + size * 0.12;
  g.add(dome);
  return g;
}

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Footprint of a w×d rectangle centred at (x,z), rotated by a multiple of 90°. */
export function footprint(x: number, z: number, w: number, d: number, rotY = 0, pad = 0): Collider {
  const quarter = Math.round(rotY / (Math.PI / 2)) % 2 !== 0;
  const hw = (quarter ? d : w) / 2 + pad;
  const hd = (quarter ? w : d) / 2 + pad;
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
}

export type Lantern = { light: THREE.PointLight; glass: THREE.MeshStandardMaterial; lit: number; target: number; seed: number };

/** Hanging brass lantern with its own point light (starts unlit). */
export function lantern(lanterns: Lantern[]) {
  const g = new THREE.Group();
  const glass = (M.glass as THREE.MeshStandardMaterial).clone();
  const body = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.34, 6), glass);
  g.add(body);
  const cap = mesh(new THREE.ConeGeometry(0.2, 0.22, 6), M.brass);
  cap.position.y = 0.28;
  g.add(cap);
  const base = mesh(new THREE.CylinderGeometry(0.17, 0.08, 0.08, 6), M.brass);
  base.position.y = -0.2;
  g.add(base);
  const light = new THREE.PointLight(0xffa04a, 0, 10, 2);
  g.add(light);
  lanterns.push({ light, glass, lit: 0, target: 0, seed: Math.random() * 100 });
  return g;
}

/** Lantern on a carved sandstone post. */
export function lanternPost(lanterns: Lantern[]) {
  const g = new THREE.Group();
  g.add(box(0.36, 0.3, 0.36, M.sandstone, 2));
  const post = mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6), M.sandstone);
  post.position.y = 1.4;
  g.add(post);
  const arm = box(0.08, 0.08, 0.7, M.brass);
  arm.position.set(0, 2.5, 0.3);
  g.add(arm);
  const l = lantern(lanterns);
  l.position.set(0, 2.25, 0.6);
  g.add(l);
  return g;
}

/** Date palm: curved segmented trunk with drooping fronds. */
export function palm(height = 5, lean = 0.25) {
  const g = new THREE.Group();
  const segs = 7;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const segH = height / segs;
    const s = mesh(new THREE.CylinderGeometry(0.16 - t * 0.05, 0.2 - t * 0.05, segH * 1.05, 6), M.palmTrunk);
    const dx = lean * segH * (t + 0.3);
    s.position.set(x + dx / 2, y + segH / 2, 0);
    s.rotation.z = -Math.atan2(dx, segH);
    g.add(s);
    x += dx;
    y += segH;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const leafGeo = new THREE.PlaneGeometry(0.5, 2.4, 1, 4);
    leafGeo.translate(0, 1.2, 0);
    const p = leafGeo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k);
      p.setZ(k, -0.18 * yy * yy); // droop
      p.setX(k, p.getX(k) * (1 - yy / 2.6));
    }
    leafGeo.computeVertexNormals();
    const leaf = mesh(leafGeo, M.palmLeaf);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = (i / fronds) * Math.PI * 2;
    leaf.rotation.x = -1.0 + (i % 2) * 0.25;
    crown.add(leaf);
  }
  g.add(crown);
  return g;
}

/** Market stall: posts, a sloped block-print cloth awning, a counter with spice mounds. */
export function stall(w = 3, d = 2) {
  const g = new THREE.Group();
  for (const [x, z, h] of [[-w / 2, -d / 2, 2.6], [w / 2, -d / 2, 2.6], [-w / 2, d / 2, 2.1], [w / 2, d / 2, 2.1]]) {
    const p = mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 5), M.wood);
    p.position.set(x, h / 2, z);
    g.add(p);
  }
  const awningGeo = new THREE.PlaneGeometry(w + 0.4, d + 0.6, 6, 3);
  const pos = awningGeo.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setZ(k, 0.08 * Math.sin(pos.getX(k) * 3)); // cloth sag
  awningGeo.computeVertexNormals();
  worldUV(awningGeo, 2.5);
  const awning = mesh(awningGeo, M.fabric);
  awning.rotation.x = -Math.PI / 2 + 0.25;
  awning.position.y = 2.4;
  g.add(awning);
  const counter = box(w * 0.9, 0.8, 0.7, M.wood, 2);
  counter.position.z = d / 2 - 0.4;
  g.add(counter);
  for (let i = 0; i < 4; i++) {
    const mound = mesh(new THREE.ConeGeometry(0.22, 0.3, 7), SPICES[(i + Math.floor(w * 7)) % SPICES.length]);
    mound.position.set(-w * 0.35 + (i * w * 0.7) / 3, 0.95, d / 2 - 0.4);
    g.add(mound);
  }
  return g;
}

export type HaveliOpts = { w: number; d: number; floors: number; wall: THREE.Material; jharokha?: boolean; roofChhatris?: boolean };

/**
 * Rajasthani haveli facing +z: sandstone plinth and cornices, plastered walls, an arched carved
 * doorway, glowing jali windows, an optional jharokha balcony and rooftop chhatris.
 */
export function haveli(o: HaveliOpts, jalis: THREE.Mesh[]) {
  const g = new THREE.Group();
  const floorH = 2.6;
  const H = o.floors * floorH;
  g.add(box(o.w + 0.3, 0.45, o.d + 0.3, M.sandstone));
  const body = box(o.w, H, o.d, o.wall);
  body.position.y = 0.45;
  g.add(body);
  for (let f = 1; f <= o.floors; f++) {
    const band = box(o.w + 0.2, 0.16, o.d + 0.2, M.sandstone);
    band.position.y = 0.45 + f * floorH - 0.08;
    g.add(band);
  }
  // Crenellated parapet.
  const top = 0.45 + H;
  const merlons = Math.floor(o.w / 0.7);
  for (let i = 0; i < merlons; i++) {
    const m = box(0.36, 0.45, 0.3, M.sandstone, 2);
    m.position.set(-o.w / 2 + 0.35 + (i * (o.w - 0.7)) / (merlons - 1), top, o.d / 2 - 0.15);
    g.add(m);
  }
  // Doorway: sandstone pointed-arch surround with the carved door set behind it.
  const front = o.d / 2;
  const frame = archWall(2.0, 2.9, 0.25, 1.3, 1.6, M.sandstone, 2);
  frame.position.set(0, 0.45, front + 0.12);
  g.add(frame);
  const door = mesh(new THREE.PlaneGeometry(1.3, 2.3), M.door);
  door.position.set(0, 0.45 + 1.15, front + 0.02);
  g.add(door);
  // Jali windows on upper floors.
  for (let f = 1; f < o.floors; f++) {
    for (const x of [-o.w / 3, o.w / 3]) {
      if (o.jharokha && f === 1 && x > 0) continue;
      const jali = mesh(new THREE.PlaneGeometry(0.8, 1.2), M.jali, { cast: false });
      jali.position.set(x, 0.45 + f * floorH + 1.2, front + 0.02);
      g.add(jali);
      jalis.push(jali);
      const lintel = box(1.0, 0.12, 0.12, M.sandstone, 2);
      lintel.position.set(x, 0.45 + f * floorH + 1.82, front + 0.06);
      g.add(lintel);
    }
  }
  if (o.jharokha && o.floors > 1) {
    // Projecting balcony on carved brackets with a curved "bangaldar" roof.
    const jx = o.w / 3;
    const jy = 0.45 + floorH + 0.5;
    const jh = box(1.5, 1.5, 0.8, M.sandstone, 2);
    jh.position.set(jx, jy, front + 0.4);
    g.add(jh);
    const jali = mesh(new THREE.PlaneGeometry(1.1, 1.0), M.jali, { cast: false });
    jali.position.set(jx, jy + 0.8, front + 0.81);
    g.add(jali);
    jalis.push(jali);
    const roofGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.8, 10, 1, false, 0, Math.PI);
    const roof = mesh(roofGeo, M.tiles);
    roof.rotation.z = Math.PI / 2; // half-cylinder axis along x, curve facing up
    roof.scale.set(1, 1, 0.75);
    roof.position.set(jx, jy + 1.5, front + 0.4);
    g.add(roof);
    for (const bx of [-0.5, 0.5]) {
      const br = mesh(new THREE.ConeGeometry(0.16, 0.5, 4), M.sandstone);
      br.rotation.x = Math.PI;
      br.position.set(jx + bx, jy - 0.2, front + 0.4);
      g.add(br);
    }
  }
  if (o.roofChhatris) {
    for (const x of [-o.w / 2 + 0.8, o.w / 2 - 0.8]) {
      const c = chhatri(1.2);
      c.position.set(x, top, o.d / 2 - 0.8);
      g.add(c);
    }
  }
  return g;
}
