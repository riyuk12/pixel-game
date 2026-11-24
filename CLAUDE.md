# pixel-story-game

3D pixel-art story game (three.js + ink), fantasy Banaras. See README.md for the pipeline.

## Required in every session

**Before editing anything:**
1. Read `AESTHETICS.md` in full — the art bible: rendering rules, light, architecture, cutaway,
   animation, and the "Never again" table of things the user already rejected.
2. Read the latest entries of `PROJECT_LOG.md` — what was built, decided and left open.

**When done (before the final reply):**
1. Append an entry to `PROJECT_LOG.md`: date, what was asked, what changed and why, files
   touched, how it was verified, Gemini spend, open items.
2. Update `AESTHETICS.md` if anything about the look changed: edit the affected rule in place,
   add rejected approaches to "Never again", and add one line to its Changelog.

If the user asks for something that contradicts `AESTHETICS.md`, do what they ask and update the
file to match — their latest word wins and the file records it.

## Standing rules

- **Every image the user pastes goes into the mood boards.** Copy it to
  `moodboards/images/<YYYY-MM-DD>_<nn>_<short-name>.<ext>` and add an entry to
  `moodboards/boards.json` (boards, credit/source, 2–3 takeaways for art direction). Playtest
  screenshots go on the `playtest` board. Browse at `/moodboard.html` on the dev server.
- **Map first, visuals second.** The level layout lives in `src/world/banarasMap.ts`
  (tile grid + zones + points of interest + route). Diagram at `/map.html`. Map changes
  get user approval before 3D/visual work builds on them.
- Gemini art: game assets in `art-src/prompts.json` (`npm run art:gen`, then `npm run art:process`);
  concept frames in `art-src/concepts.json` (`npm run art:concepts`, viewed at `/concepts.html`).
  Every call is logged with an estimated price in `art-src/spend.log` — keep within the budget the user sets.
- Don't run heavy headless screenshot batches while the user is playtesting; prefer one targeted
  shot (`node tools/shots.mjs name:x,y[:yaw[:pitch[:zoom]]]`) or `node tools/health.mjs`.
- Dev pages: `/` game · `/map.html` map plan · `/concepts.html` concept frames · `/moodboard.html` mood boards.
