# Project log

**Every Claude Code session must read the latest entries here before editing, and append an
entry when done** (newest at the bottom): date, what was asked, what changed and why, files
touched, how it was verified, money spent, open items. Keep entries factual and short; the
look-and-feel rules themselves live in `AESTHETICS.md`.

---

## 2026-11-24 — Session 1 (from nothing to a playable 3D Banaras slice)

### 1. Direction and prototype
- **Asked:** a web-based, story-driven 3D game with realistic lighting but pixelated output; don't
  rely on Claude for the art.
- **Decided:** three.js + Vite + TypeScript; render low-res and upscale with hard pixels; story in
  **ink** (inkjs); Gemini (image-gen plugin, Nano Banana) for all 2D art; full 3D characters.
- **Built** in `~/Desktop/pixel-story-game` (kept out of the vfai-cocktail repo at the user's
  request): low-res pipeline (outlines, AO, bloom, Bayer dither), pixel-snapped camera, a
  procedural Indo-Persian village, KayKit CC0 characters (recoloured), ink dialogue with Gemini
  portraits, the "Last Lamplighter" scene. Art scripts `art-src/gen.mjs` + `process.mjs`.
- Setting moved from European → Indo-Persian → **Banaras** with the user's mood boards.

### 2. Mood boards and the map
- **Asked:** store every pasted image as inspiration; plan the map in code and show a 2D diagram
  before visuals.
- **Built:** `moodboards/` + `boards.json` + `/moodboard.html`; the level as an editable ASCII
  grid with zones, POIs and a route in `src/world/banarasMap.ts`; `/map.html` draws it and checks
  it (row lengths, reachability, height-aware steps).
- **Iterations:** Courtyard of Lamps became a multistorey stepwell (3 tiers to a sacred pool,
  island shrine, banyan, gallery); 115 seeded houses with doors on lanes; three dead-end galis;
  gallery's south arm later removed so the camera can see into the well.
- **Approved** by the user as a basic pre-visual.

### 3. Concept art and character designs (Gemini)
- 11 concept frames (Nano Banana Pro) as in-game screenshots, incl. two aerial overviews built
  from the map image; `/concepts.html` with a game-resolution toggle.
- 10 character design sheets (traveller, lamplighter, aarti priest, Kathak dancer, flower seller,
  sadhu, chai wallah, boatman, silk weaver, townsfolk).
- Textures: golden sandstone, carved relief, plaster (blue/ochre/rose/white), roof, terracotta,
  marigold, brocade, bandhani, bark, foliage; facade decals (doors, windows, shopfront, mural,
  niche, jharokha); sky panorama (8:1, Nano Banana 2 — Pro doesn't do 8:1).
- One decal blocked by Gemini safety ("red handprints") — reworded and regenerated.

### 4. The 3D slice (`src/world/banaras/`)
- Terrain from the grid (stepped ghats/stairs/tiers, smooth walking heights, padding beyond the
  edges); houses with recessed openings and Gemini decals; landmarks (Old Temple, Ghat Temple,
  palace + tunnel, arches, gallery arcade); props (stalls, shrines, banyan, boats, umbrellas,
  ~700 instanced diyas, lamps); crowd (~45 placed + 12 walkers); ink knots for every POI;
  lamplighter scene lights the island shrine.
- Verified with headless Chrome playtests (`tools/playtest.mjs`, `tools/shots.mjs`): 60 fps,
  no console errors, story end-to-end.

### 5. Playtest feedback → changes (in order)
1. Needs 3D camera rotation; too big and flat → orbit camera, recessed facades, normal maps,
   pilasters, parapets.
2. Free kitbash models → research agent found no free, no-login CC Indian architecture kit
   (props on poly.pizza / Poly Haven; real Indian buildings only on Sketchfab with a token).
   **User: skip kitbash for now.**
3. No animation, no sense of fantasy → wind cloth, smoke, walkers, birds, boats; Gemini skyline,
   sky lanterns, motes, lotuses, colossal temple, shrine pillar of light, split-tone grade.
4. No borders → custom 2 px outline pass. Pixels move with the camera → orthographic + whole-pixel
   snapping (perspective reverted).
5. Realistic lighting is the problem → cel shading with soft band blends.
6. Too clustered → wider houses (3–6 tiles), calmer facades, bigger people (×1.15) and props (×1.3).
7. Pixels shift with camera angle → yaw in 45° steps, pitch presets, zoom levels.
8. Roofs all the same, need windows → windows above neighbours' roofs, rooftop rooms with
   bangaldar vaults/domes, four parapet styles, varied roof surfaces, roof clutter, white trim.
9. Tunnel made the palace vanish → depth-aware cutaway; circle version disliked (hid decor) →
   front cut only on buildings that block the player, knee-high stubs, everything behind kept;
   finally applied to **all** buildings and the orb removed. **User: "now perfect".**

### Spend
- Gemini, logged in `art-src/spend.log`: **$3.67** across 41 images since the $10 budget was
  set (plus ~$0.60 unlogged before logging existed).

### Verification state at end of session
- `npx tsc --noEmit` clean; `npm run build` passes; `node tools/health.mjs`: starts in ~2.4 s,
  60 fps headless, no console errors.

### Open items
- Real 3D character models (design sheets exist): sprites from the sheets, or image-to-3D
  (needs a Meshy/Tripo account) — user to decide.
- Kitbash: parked by the user (options recorded in item 5.2).
- No version control for the game folder (it sits inside an empty `~/Desktop` git repo with no
  commits). Ask before initialising anything.

---

## 2026-11-24 — Session 1, continued: project docs and the cutaway, take two

- **Asked:** a project log and an aesthetics file every session must read before editing and
  write to when done. **Done:** `PROJECT_LOG.md`, `AESTHETICS.md`, and `CLAUDE.md` now requires
  both (README links them; memory updated).
- **Asked (screenshots 07, 08):** the plane cut left windows, hoods, balconies floating and thin
  dithered slices — "keep a building as one object". **Changed:** the cut is now per building:
  one switch per building, everything above its floor + 0.9 m dissolves together
  (`materials.cutPatch`, `landmarks.asOccluder(group, stubY)`). To keep things behind the player,
  the palace is built as five pieces and the Natya Haveli in two (`landmarks.palace`,
  `buildings.buildCity`); palace wings got interior floors.
- **Asked (screenshot 09):** glitching on the tunnel. **Found:** cut pieces still cast shadows
  (diagonal streaks with no caster) and the cut flickered while walking under the bridge.
  **Changed:** 0.6 s hold before a cut building is restored; cut buildings stop casting shadows
  (castShadow toggle — a cut-aware shadow shader worked but cost ~25% fps, so it was dropped).
  Palace upper piece's stub lowered so the bridge over the tunnel goes with it.
- **Files:** `src/world/banaras/{materials,landmarks,buildings,occlusion,index}.ts`,
  `moodboards/boards.json` (+3 playtest screenshots), `AESTHETICS.md`, `PROJECT_LOG.md`,
  `CLAUDE.md`, `README.md`, `tools/health.mjs`, `tools/debug-occlusion.mjs` (new: reports which
  buildings the cutaway flags at a tile + yaw).
- **Verified:** `tsc` clean; screenshots of a lane at 45° and the palace tunnel (player visible
  inside, palace behind intact); `tools/health.mjs` no errors, ~47 fps headless (noisy while the
  user's tab renders the same scene).
- **Spend:** none this round.
- **Open:** real character models; kitbash parked; version control for the game folder (ask).

---

## 2026-11-24 — Session 1, continued: per-cell cutaway and tilt-shift

- **Asked (screenshots 10–11):** walking behind a big building made the whole building vanish —
  only the wall blocking the view should go. **Changed:** houses and walled blocks are cut per
  2 m map cell. Every vertex records its owning cell (`aCutTile`, `geo.ts` Builder.owner /
  `ownCell`); a 52×44 cut texture (`materials.CUT_CELLS`) holds each cell's cut value;
  `occlusion.ts` traces sight lines across the grid against per-cell heights
  (`buildings.CELL_TOPS`). Dark interior walls between cells close the gaps; one shared
  cell-aware shadow material. Landmark pieces still cut whole.
- **Asked:** "the character and a bit of their surroundings should be visible". **Changed:**
  sight lines start from a patch ~6 m across × 3 m deep × head height around the character.
- **Bug found while verifying:** wall meshes had no cell tags (their QuadSet was grabbed before
  the owner was set) → walls could never be cut. Fixed: QuadSet reads the builder's owner live.
- **Asked (screenshot 12):** the wall ahead of the character was being cut. **Cause:** sight
  lines starting inside the building the character stood against. **Fixed:** start points inside
  buildings are skipped; verified no cells beyond the character are cut at yaw 0° and 45°.
- **Asked:** a very slight tilt-shift for realism. **Added:** `TiltShiftShader` in
  `pixelRenderer.ts` (sharp middle band, ≤1.35 px blur at top/bottom).
- **Files:** `src/world/banaras/{geo,materials,buildings,occlusion}.ts`, `src/render/pixelRenderer.ts`,
  `src/main.ts` (exposes `cellTops` for debugging), `tools/debug-occlusion.mjs` (now reports the
  blocking cell, its cut value and whether it was marked), `moodboards/boards.json` (+3).
- **Verified:** `tsc` clean; `tools/health.mjs` no errors (~46 fps headless while the user's tab
  also renders); bazaar at 45° shows the character, stalls and people; debug tool confirms the
  blocking wall's cell is marked and cut, and that nothing beyond the character is cut.
- **Spend:** none. **Open:** character models; kitbash parked; version control (ask).

---

## 2026-11-24 — Tilt-shift stronger

- **Asked:** make the tilt-shift a bit stronger. **Changed:** `TiltShiftShader` (`src/render/pixelRenderer.ts`)
  edge blur 1.35 → 2.2 low-res px, sharp band ±20% → ±16% of screen height; blur now samples two
  rings (16 taps) so the stronger blur doesn't ghost.
- **Verified:** `tsc` clean; `tools/health.mjs`: starts, no errors, ~54 fps headless. **Spend:** none.
- **Follow-up:** 2.2 px was "a bit too strong" → settled at 1.8 px edge blur, ±18% sharp band.

---

## 2026-11-24 — Version control on the personal GitHub

- **Asked:** put the game on the personal GitHub, not the office one.
- **Done:** the game folder is its own git repo (it used to sit inside an empty `~/Desktop` repo).
  Commits use a repo-local identity (Rajat Bose, personal Gmail) — never the global VerbaFlo
  email. Remote `git@github-riyuk12:riyuk12/pixel-game.git` goes through the personal SSH
  key (`~/.ssh/config` host `github-riyuk12`); the `gh` CLI stays logged into the work account
  and is not used for this repo. Private repo (mood boards hold copyrighted reference art).
- **Ignored:** `node_modules`, `dist`, `playtest-output`, `art-src/preview`, the 237 MB of original
  Gemini PNGs in `art-src/raw` (their prompt sidecars `.md` are kept), `.vercel`.
- **How to push from now on:** `git push` (the remote already uses the personal key). Never push
  this repo with the work account.
- **Deploying:** `npm run build && npx vercel deploy dist --prod` (only the built `dist/`, 11 MB).

