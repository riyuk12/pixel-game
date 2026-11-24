# Aesthetics — the art bible

**Every Claude Code session must read this file before editing anything that affects how the
game looks, and must update it when done** (rules that changed → edit them in place; always add a
line to the [Changelog](#changelog) at the bottom). If a request conflicts with a rule here, follow
the request and update the rule — the user's latest word wins, and this file records it.

Mood references: `moodboards/` (browse `/moodboard.html`). Concept frames: `/concepts.html`.
Level layout: `src/world/banarasMap.ts` (plan at `/map.html`).

---

## 1. Pillars

1. **A fantasy Banaras, not a documentary one.** Ghats, havelis, stepwells and temples, pushed
   towards myth: colossal spires, sky lanterns, glowing motes, a mythic skyline.
2. **A 3D diorama drawn as pixel art.** Real 3D geometry, rendered low-res with hard pixels,
   bold outlines and cel-shaded light — never smooth, never photoreal.
3. **Firelight against indigo night.** Warm saffron/gold lamps and fires; cool indigo-teal
   shadows. Never one flat orange wash.
4. **Nothing is ever still.** Cloth moves, smoke rises, people walk, birds wheel, lanterns rise,
   water glints.
5. **Wide, calm, readable.** Fewer, broader buildings; detail where the eye lands; lanes stay
   readable from the camera.

## 2. Rendering — non-negotiable

| Rule | Value / where |
|---|---|
| Internal resolution | ~360 lines, whole-number upscale, `image-rendering: pixelated` (`TARGET_LINES` in `src/render/pixelRenderer.ts`) |
| Camera | **Orthographic only.** Perspective made pixels swim. |
| Pixel stability | Camera position snapped to whole low-res pixels in its own frame; leftover fraction slides the canvas. |
| Rotation | **Fixed steps only:** yaw 45° (`YAW_STEP`), pitch presets 25°/34°/45°/60°, zoom levels 12/14/17/20/24/28/34 px per metre (default 20). Quick ease *between* steps; never continuous rotation (pixel runs stretch: `...` → `......`). |
| Outlines | Custom `OutlinePass` (`src/render/outlinePass.ts`): **2 px** dark silhouette (darkness 0.78, depth jump 0.35 m) + light crease highlights (0.45). |
| Shading | **Cel shading**, not physically based: every lit material is converted to `MeshToonMaterial` (`toonify` in `materials.ts`). Four bands `[[0,.2],[.5,.52],[.64,.82],[.84,1]]` with a **soft ±0.035 blend** between bands. |
| Grade | ACES, exposure 1.0; saturation 1.18; teal-indigo shadow tint `(0, .035, .09)`; warm gold highlight lift; 4×4 Bayer dither at 40 levels. |
| Glow | Bloom 0.7 / radius 0.4 / threshold 0.82 — for fire, lamps, jalis, lanterns only. |
| Ambient occlusion | GTAO at 0.7 blend, fed the outline pass's own depth + normals. |
| Tilt-shift | Noticeable miniature blur: sharp band through the middle (±18% of screen height), easing to 1.8 low-res px at the top and bottom edges, two-ring blur so it stays smooth (`TiltShiftShader`). |
| Normal maps | Every Gemini texture gets a relief normal map (`art-src/process.mjs`), used at 0.6× under cel shading. |

## 3. Light and colour

- **Time:** late dusk. Low orange sun `#ff9a50` ×2.1 from the west-south-west; violet-blue sky
  fill (hemisphere `#4a5cc8` / `#221820` ×0.75); **cool moonlight** `#8090ff` ×0.55 from the
  north-east. Haze `#3a2e5c` (starts just behind the player — camera sits 320 m back).
- **Practical lights** carry the scene: aarti fires, the stepwell, chai stove, bazaar lamps,
  jalis. Lamps flicker. The stepwell is the brightest place in the city.
- **Palette:** saffron, marigold, sandstone gold, deep maroon, indigo, violet shadow; accents of
  turquoise tile, rose and blue-washed plaster. Pink/blue houses take **white trim**; ochre,
  sandstone and white houses take sandstone trim.

## 4. Architecture

- **Style:** Banaras ghats + Rajasthani havelis — carved sandstone, jharokhas, jalis, chhatris,
  onion domes, terracotta, lime plaster in blue / ochre / rose / white / sandstone.
- **House size:** frontages of **3–6 tiles** (6–12 m), up to 5 tiles deep, 2–6 storeys. Small
  2 m houses read as noise — don't go back.
- **Facades:** real depth — recessed doors (0.45 m), deep open shopfronts (1.1 m), windows
  recessed 0.3 m with sills, frames and terracotta/stone hoods; cornice every storey;
  **pilasters only at house corners**; jharokhas over doors. Window decals are Gemini panels
  (`dec_*`).
- **Every wall that rises above a neighbour's roof gets windows** — no blank walls on the
  roofscape.
- **Roofs must never look alike.** Mix per house:
  - surface: lime / grey / rose / standard plaster / terracotta;
  - edge: plain parapet with coping, pierced jali screen, terracotta eave, **merlons on only
    ~1 house in 5**;
  - rooftop rooms (barsati) on ~60% of bigger houses: own windows, door, curved terracotta
    (bangaldar) roof or small white dome;
  - life: water tanks, potted plants, charpai, laundry, occasional chhatri, stair huts.
- **Landmarks are oversized on purpose:** Old Temple spire ~54 m with glowing gold bands; the
  palace stepped in tiers with domes and chhatris; the stepwell walled, arcaded, glowing.

## 5. Visibility — the cutaway

- **Houses and walled blocks are cut per 2 m map cell.** Sight lines run from the character and a
  patch of open ground around them (~6 m across, ±1.5 m along the view, up to head height) to the
  camera; only cells whose building rises above a sight line are cut. The character **and a bit
  of their surroundings** must always be visible.
- **A cut cell takes everything it owns** — walls, windows, balconies, awnings, rooftop room,
  domes, clutter (every vertex is tagged with its cell) — so nothing floats. It dissolves with a
  pixel dither down to **knee-high stubs** (its building's floor + 0.9 m) over a dark interior
  floor. Where a neighbouring cell stays, a dark interior wall closes the gap.
- **Nothing beyond the character is ever cut**: sight lines never start inside a building, and
  they only travel towards the camera. Everything behind the character stays drawn.
- **Landmark pieces** (palace wings / upper tiers / tunnel mouths, temples, archways, gallery
  arcade) are cut whole, piece by piece.
- Cuts **hold ~0.6 s** after they stop blocking (no flicker). Cut cells cast no shadow (one
  shared cell-aware shadow material); cut landmark pieces stop casting shadows.
- Street decor that isn't part of a building (flags, cloth, kites, stalls, trees, people) is
  never cut.

## 6. Life and animation

- Cloth: wind on every awning/sari/flag; hanging cloth swings from its pin.
- Smoke from aarti fires, chai stove, kadhai, temple, stepwell. Gold/teal motes in sacred places.
- ~240 sky lanterns rising from the river; glowing lotuses and glints on the water.
- ~12 walkers on routes plus ~45 placed people (priests performing aarti, dancer spinning,
  dhobis beating laundry, sellers, worshippers); pigeons circling; boats bobbing, two rowing.
- Story beats get a visual payoff (the island shrine's pillar of light).

## 7. Characters and scale

- People ~2.05–2.1 m (slightly heroic); props scaled ×1.3; diyas enlarged — readable at 20 px/m.
- Design reference: Gemini character sheets in `/concepts.html` (Characters). In-game models are
  KayKit stand-ins recoloured per costume (`char_*` textures) until real models exist.

## 8. Art pipeline

- All 2D art is Gemini (image-gen plugin, Nano Banana 2 / Pro) via `art-src/gen.mjs`; every call
  is logged with cost in `art-src/spend.log` — respect the budget the user sets.
- Texture prompts: "stylized hand-painted video game texture with clear, readable shapes", flat
  front-on, evenly lit, no text. Decals fill the frame edge to edge.
- Concept prompts: "in-game screenshot of a 3D pixel-art story adventure… orthographic elevated
  three-quarter view… realistic light rendered at low resolution, hard pixels, dark outlines".
- Every image the user pastes goes into `moodboards/` with takeaways.

## 9. Never again (lessons from playtests)

| Tried | Why it failed |
|---|---|
| Physically based "realistic" lighting | Looked flat and un-pixel-art; cel shading instead. |
| Perspective camera | Pixels swam whenever the camera moved. |
| Continuous rotation / smooth zoom | Pixel runs stretch and crawl; fixed steps only. |
| Faint or 1 px outlines | Buildings didn't read as 3D pixel art. |
| Whole-building fade when occluding | The palace vanished around the player, behind included. |
| Circle (orb) cutaway | Hid flags and decor in thin streets. |
| Wide always-on front cut (14 m band) | Nibbled buildings beside/behind the player. |
| Per-pixel plane cut through a building | Left jharokhas, hoods and frames floating, and thin dithered slices through houses. |
| Cut buildings still casting shadows | Long shadow streaks with no visible caster ("glitching" on the palace). |
| Cut state re-evaluated every frame with no hold | Flickered as the player walked under the palace bridge. |
| Whole-building cut (one switch per house) | Walking behind a big building made all of it vanish. |
| Sight lines starting from points inside buildings | Cut the wall in front of the character's face (beyond them). |
| Narrow sight-line band (body only) | At 45° a diagonal wall still covered the character. |
| Many 2 m houses, window on every tile, pilaster every 2 m | Cluttered, busy, unreadable. |
| Identical flat roofs ringed with orange merlons | "Everything looks the same". |
| Orange-on-orange (sandstone + sun + paving) | Monotone; needs cool shadows and white trim. |
| High pitch / big zoom | Mostly rooftops, facades unseen. |

---

## Changelog

Newest last. One line per change to the look: date — what changed — why.

- 2026-11-24 — First look: low-res render + outlines + realistic light, prototype village.
- 2026-11-24 — Setting pivot to Indo-Persian, then Banaras (user's mood boards).
- 2026-11-24 — 3D Banaras slice built from the approved map; Gemini textures and facade decals.
- 2026-11-24 — Perspective camera tried for depth; reverted to orthographic + pixel snapping (pixels swam).
- 2026-11-24 — Custom outline pass, then thickened to 2 px (user).
- 2026-11-24 — Cel shading with soft band blends replaces realistic lighting (user).
- 2026-11-24 — Fantasy layer: Gemini skyline panorama, sky lanterns, motes, lotuses, 54 m temple, shrine pillar, split-tone grade.
- 2026-11-24 — Animation: wind cloth, smoke, walkers, birds, boats.
- 2026-11-24 — Wider houses (3–6 tiles), calmer facades, bigger people/props, closer camera (user: "too clustered").
- 2026-11-24 — Camera quantised to 45° / pitch presets / zoom levels (user: pixels shifting with angle).
- 2026-11-24 — Roof overhaul: windows above neighbours, rooftop rooms, varied parapets/surfaces, roof clutter, white trim (user: "roofs all the same").
- 2026-11-24 — Cutaway: front cut only for blocking buildings, knee-high stubs; orb removed; applied to all buildings (user).
- 2026-11-24 — Cutaway now cuts each blocking building as ONE object above its own stub line; palace and haveli split into pieces; 0.6 s hold; cut buildings drop their shadows (user: floating window artifacts, tunnel glitch).
- 2026-11-24 — Cutaway is now per 2 m cell with a cleared patch around the character; dark interior walls between cut/uncut cells; nothing beyond the character is cut (user: big building vanished, wall ahead cut, "character and a bit of their surroundings should be visible").
- 2026-11-24 — Very slight tilt-shift blur added (user: "adds to the realism").
- 2026-11-24 — Tilt-shift strengthened: edge blur 1.35 → 2.2 px, sharp band ±20% → ±16% (user: "a bit more strong").
- 2026-11-24 — Tilt-shift eased back to 1.8 px / ±18% band (user: 2.2 px "a bit too strong"; 1.35 px was too faint).
