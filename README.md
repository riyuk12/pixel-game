# The Last Lamplighter — prototype

A story-driven 3D web game with a pixel-art look: the scene is rendered with real lighting
(dusk sun, shadows, lantern light, ambient occlusion, glow) at 480×270, then scaled up with
hard pixel edges. Setting: a medieval Indo-Persian town at dusk.

```bash
npm install
npm run dev        # http://localhost:5199
```

Controls: WASD / arrows to move · Shift to run · E to talk / advance · 1–9 or click for choices.

## Project docs

- `AESTHETICS.md` — the art bible: read before changing anything visual, update when done.
- `PROJECT_LOG.md` — dated log of everything built and decided; append after every session.
- `CLAUDE.md` — standing rules for Claude Code sessions (requires both of the above).

## Pages (dev server)

`/` the game · `/map.html` level plan drawn from `src/world/banarasMap.ts` · `/concepts.html`
Gemini concept frames (with a game-resolution toggle) · `/moodboard.html` reference images.

## The 3D slice (`src/world/banaras/`)

Built entirely from the approved map (`src/world/banarasMap.ts`):
`terrain.ts` stepped ghats / stairs / stepwell tiers with smooth walking heights ·
`buildings.ts` 115 seeded houses with Gemini facade decals (doors, windows, shops, murals,
niches, jharokhas) · `landmarks.ts` temples, palace + tunnel, archways, gallery arcade ·
`props.ts` stalls, shrines, banyan, boats, umbrellas, cloth, ~700 instanced diyas, lamp lights ·
`crowd.ts` ~45 placed people · `occlusion.ts` dithers away buildings that hide the player.
Inspectable places = POIs whose id has a knot in `src/story/story.ink`.

## How the look works (`src/render/pixelRenderer.ts`)

1. Scene rendered at low resolution (screen height / whole-number scale ≈ 270 lines).
2. `RenderPixelatedPass`: depth + normal edge outlines.
3. `GTAOPass` ambient occlusion, `UnrealBloomPass` glow for lanterns and jali windows.
4. ACES tone mapping, then a grade pass: slight saturation, cool shadow tint, 4×4 Bayer dithering.
5. The canvas is upscaled with `image-rendering: pixelated`.
6. The camera snaps to whole low-res pixels (no shimmer) and the canvas slides by the
   leftover sub-pixel so movement stays smooth. The sun's shadow map snaps the same way.

Tune the feel with `PIXELS_PER_UNIT` / `TARGET_LINES` (zoom, resolution), the camera
`yaw` / `pitch`, and `GradeShader` uniforms (`levels` = dither strength).

## Art pipeline (`art-src/`)

All 2D art is generated with Gemini (Nano Banana 2) — textures, portraits, title art.

| Step | Command | What it does |
|---|---|---|
| Generate | `npm run art:gen -- [id ...] [--force]` | Reads `art-src/prompts.json`, calls Gemini, saves to `art-src/raw/` with a prompt sidecar `.md`. Needs `GEMINI_API_KEY`. |
| Process | `npm run art:process` | Makes textures seamless, shrinks everything to a true pixel grid, reduces the palette, recolours the characters → `public/`. |

**Style references:** reference images live in mood boards (`moodboards/boards.json`,
browse at `/moodboard.html`). A prompt with `"refs": true` sends every board image (max 14)
to Gemini; `"refs": ["riverfront", "rituals"]` sends only those boards.
Re-run e.g. `npm run art:gen -- keyart_title portrait_player portrait_lamplighter --force`
then `npm run art:process`.

**3D models** are KayKit Adventurers (CC0, Kay Lousberg) as placeholders — `Rogue_Hooded`
(player) and `Mage` (lamplighter, hat hidden, procedural turban + brass lamp). Any rigged
`.glb` with `Idle` / `Walking_A` / `Running_A` clips drops in via `loadCharacter`
(`src/world/characters.ts`); Mixamo characters work after renaming the clips.

**Architecture** (havelis, pointed arches, onion domes, chhatris, palms, stalls, palace) is
built from simple shapes in `src/world/kit.ts`; the Gemini textures carry the detail.
Blender models (`.glb`) can replace any piece later.

## Story (`src/story/story.ink`)

Written in [ink](https://www.inklestudios.com/ink/) — edit in the free Inky editor or any
text editor; the game compiles it at startup.

- `LAMPLIGHTER: text` → spoken line with that character's portrait (map in `src/story/dialogue.ts`)
- plain text → narration
- `# light_lanterns` → a game event (handlers in the `tags` table in `src/main.ts`)
- Each interactable in `src/main.ts` starts a knot (`lamplighter`, `palace_gate`).

## Layout

```
src/render/pixelRenderer.ts   low-res renderer, post-processing, pixel-snapped camera
src/world/kit.ts              materials + architecture pieces
src/world/village.ts          town layout, lighting, colliders
src/world/characters.ts       glTF loading, recolour, animation, turban/lamp props
src/story/                    ink script + dialogue box
art-src/                      Gemini prompts, generator, processor, raw outputs, refs/
public/                       game-ready textures, portraits, models
```
