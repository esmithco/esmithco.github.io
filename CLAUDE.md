# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brayan Mendoza's personal static site, served by **GitHub Pages** as an organization page (`esmithco.github.io`) directly from the root of the `main` branch. There is **no build system, no framework, no package.json, no tests, no linter** — every page is hand-written static HTML/CSS/JS. Deploying is `git push`.

Independent sections, each self-contained:
- **`index.html` + `site.css`** — the personal home page (card grid linking to the sub-apps).
- **`fitness/index.html`** — the gym-routine app. A **single file** with all CSS and JS inline; state persists in `localStorage`.
- **`books/`** — a reading-notes library with a dynamic reader.
- **`aws/index.html`** — a standalone reference page (the AWS backend learning plan), in the grid-paper note style.
- **`ajedrez/`** — chess opening & trap trainer (Spanish UI). See "Chess trainer architecture" below.

**Shared visual system (keep it cohesive):** cool, light palette — ink `#172033`/`#1e2631`, light surfaces. Three accent hues used consistently: **blue `#2563EB`/`#2F5FE0`** (fitness), **teal `#0E9488`/`#0e8f82`** (books), **amber/orange `#E8730C`** (aws). The **home page** (`index.html`) background is soft rounded color **blobs** (radial-gradients in blue/teal/amber) on `#F5F7FB` — *not* a grid; four white cards (2×2 grid) with colored top accent bars; the chess card uses **violet `#7C3AED`**. Headings are Georgia serif; small labels/links use a monospace stack. Favicons are inline-SVG rounded squares (home = navy "B", books = teal book, fitness = blue dumbbell, aws = amber cloud). Fitness keeps **functional day colors** (`--blue/red/yellow/green` = Mon/Tue/Thu/Fri; brand `--accent` = blue). Book **note pages** and the **aws page** keep the grid-paper study style; the home page deliberately does not.

## Deploying / running

- **Deploy = commit + push to `main`.** GitHub Pages rebuilds in ~1 minute. There is nothing to build.
  ```bash
  git add -A && git commit -m "..." && git push origin main
  ```
- **Preview locally over HTTP, never `file://`.** Relative refs (`site.css`, `reader.js`, note paths) do not resolve from `file://`, and the in-app browser renders local files as `data:` snapshots where relative CSS and `localStorage` break. Serve the repo root:
  ```bash
  python3 -m http.server 8912
  # then open http://127.0.0.1:8912/fitness/index.html etc.
  ```
- **Do NOT run `./publish.sh` or `books/generate-index.mjs`.** They are **legacy**. `generate-index.mjs` regenerates a *flat, outdated* `books/index.html` (linking `reader.html?note=<file>`) that would **clobber the current hand-maintained `books/index.html`** (which links `chapters.html?book=forecasting` and drives the dynamic reader below). Edit `books/index.html` by hand; never regenerate it. The root and `books/` `README.md` describing `publish.sh` are likewise stale.

## Books reader architecture (the non-obvious part)

The reader is **dynamic and build-free** — new notes appear automatically after a push, with no index to regenerate:

- Notes live under `books/notes/fpp3/chap N/` — one folder per chapter, one self-contained HTML file per note (`forecasting-chN-NN.html`).
- `books/chapters.html` and `books/reader.js` list chapters and notes from a **static manifest** at `books/notes/fpp3/manifest.json` (served by the site — **no GitHub API**, so no 60-req/hr rate limit, instant, and works locally/offline). **To add a note: (1) drop the correctly-named HTML file in the right `chap N/` folder, AND (2) add its filename to that chapter's `notes` array in `manifest.json`.** (Chapters were previously auto-discovered via the GitHub Contents API, which hit the rate limit on phones and silently broke the chapter list — the manifest replaced it.)
- Flow: `books/index.html` → `chapters.html?book=forecasting` (reads manifest → chapter cards) → `reader.html?chapter=<name>` (loads that chapter's notes into an `<iframe>`).
- `reader.js` extracts each note's `<h1>` for the note-picker menu (fetched same-origin), supports prev/next that **crosses chapter boundaries** (last note of a chapter → first of the next), keyboard arrows, and swipe. When you change `reader.js`, bump `reader.js?v=` in `reader.html`.

### Note-file conventions

Each note is a standalone HTML page (works both in the iframe and opened directly). They share a deliberate visual language — match it when adding notes:
- Google Fonts: **Fraunces** (titles), **Inter** (body), **Caveat** (handwritten labels); grid-paper background; restrained berry/sage/steel accent palette.
- Study-note components: `.definition`, `.label`, `.code` (monospace trees with color-coded `.cls`/`.fn`/`.attr`/`.mth` spans + a `.legend`), `.pair` ("never confuse" cards), `.callout`, `.node`, and a compact "remember" block. `forecasting-ch2-01.html` and `-ch2-04.html` are the canonical style references.
- Escape `<`, `>`, `&` inside `.code` blocks (`&lt;` `&gt;` `&amp;`).

## Fitness app architecture

`fitness/index.html` is one file; the `<script>` at the bottom does everything.
- **State**: `localStorage` keys `rutina4dias_progress_v1` (checkboxes), `rutina4dias_weights_v1` (weights), `rutina4dias_timer_v1` (session timer). The timer stores `{running, startedAt, elapsed}` and computes elapsed time from `Date.now()`.
- **Data-driven UI, injected on load**: exercise info (`EX_INFO`), rest times (`EX_REST`), demo images (`EX_IMG`), and per-day warm-up/stretch (`PHASES`) are JS maps keyed by day/exercise id. `setupExerciseInfo()` and `injectPhases()` build the tap-to-expand panels and checkable warm-up/stretch rows from these maps. Warm-up/stretch checkboxes carry class `aux` and are excluded from the `N/5` lift count.
- **Exercise/warm-up images** are hotlinked from the public-domain **`yuhonas/free-exercise-db`** GitHub repo (`raw.githubusercontent.com/.../exercises/<Id>/0.jpg` and `1.jpg`), loaded lazily when a panel opens. When adding exercises, verify the image `Id` returns 200 before using it, and prefer body-only (no-equipment) movements.

## Chess trainer architecture (`ajedrez/`)

Built Nov 2026 to replace/extend the Lotus Chess app: drills the exact positions where Brayan (Chess.com user **Esmithco**, 10-min rapid; repertoire: **London System** as White, **Caro-Kann** as Black, also vs 1.d4) went wrong in his own games, with spaced repetition.

Files (all static, no build):
- `index.html` — single file, all CSS/JS inline. Inline SVG piece sprite (cburnett, CC BY-SA 3.0) at the top of `<body>`; pieces drawn with `<use href="#wk">` etc. Board = CSS grid with explicit 8×8 `minmax(0,1fr)` rows/cols (an earlier version without explicit rows rendered non-square squares). Tap-to-move **and** drag (pointer events). Chess.com board colors.
- `chess.js` — chess.js **0.10.3** (old API: `move(san,{sloppy:true})`, `load_pgn`, `in_checkmate()`…). Don't upgrade casually; 1.x renamed methods.
- `stockfish.asm.js` — Stockfish.js 10.0.2 asm build, run as a same-origin Web Worker (UCI over postMessage; falls back to jsDelivr via `importScripts`).
- `datos.json` — preloaded analysis (~575 KB): 549 games, 860 drill positions, 194 traps. Loaded only when the browser has **no** localStorage state; "Cargar análisis base" in Analizar → Respaldo merges it without wiping progress.

State: `localStorage['taller-aperturas.v2']` = `{v, user, games:{[chessComUrl]:{opening, side, r:W/D/L, how, op, errors, tr, date}}, cards:{[fen4|playedSan]:{side, opening, line[SAN], played, best, s0, drop, sev, trap, after[], lostIn, count, games[], box, due, reps, lapses}}, gambits:{}}`. Card key = first 4 FEN fields + played move, so the same mistake across games increments `count`.

Analysis (in-browser, resumable, skips already-done games):
- Data comes straight from the **Chess.com public API** (CORS works): `/pub/player/<user>/games/archives` then each month.
- **Errores de apertura** (last 3 months): first 24 plies, flags the user's moves whose win-probability drop ≥ 8 (Lichess-style `wp(cp)` curve), skipping positions already |eval| > 600.
- **Trampas** (whole history): only losses ending in ≤ 50 plies, excluding timeout/abandoned; walks the first 30 plies and stops at the first move with drop ≥ 20 where the position was ≥ −200 before and ≤ −300 after. `after` = the opponent's punishing follow-up (shown by "Ver cómo te castigaron").
- Gambit stats table is computed over all games when the trap analysis runs (it also counts gambits he played himself, e.g. his old Scotch Gambit).
- Spaced repetition: boxes 0–6 → intervals `[0,1,3,7,16,35,80]` days; a miss resets to box 1 and requeues in 10 min. Alternative moves are accepted if the engine says they lose < 5 points.

Findings so far (Nov 2026; 2,473 games, 320 losses in ≤ 25 moves): most quick losses came from openings he no longer plays (1…e5 as Black, Scotch Gambit as White). Recurring repertoire traps: 1.d4 d5 2.Bf4 Nc6 3.Nc3 **Nxd4?** (twice; play 3…e6); Caro-Kann Fantasy 3.f3 dxe4 4.fxe4 Bg4? (play 4…e5); Caro Advance 4.h3 h5 5.Bg5 **e6??** loses the queen (5…Qb6); London …Nh5 hitting Bf4, 7.g4? (7.c3). Worst gambit records: vs Queen's Gambit as Black 8-0-18, Danish 1-0-4, Englund 4-0-6.

Ideas not done yet: refresh `datos.json` periodically; a curated "known traps" list for his repertoire; tactics from middlegame blunders.

## Gotchas that have bitten before

- **`overflow-x: clip`, not `hidden`.** On the fitness page, `overflow-x: hidden` on `html,body` turns the body into a scroll container and **breaks `position: sticky`** (the pinned session timer) on iOS Safari. Use `overflow-x: clip`.
- **Cache-busting via query strings.** iOS caches HTML/CSS/JS aggressively. Shared assets are versioned (`site.css?v=2`, `reader.js?v=3`); when you change `books/site.css` or `books/reader.js`, **bump the `?v=` number** in every referencing page.
- **`apple-touch-icon` / favicons are inline SVG data-URIs** in each page's `<head>` (green "B" = home, purple book = book notes, blue dumbbell = fitness, violet knight = chess). Keep the rounded-square style consistent if adding sections.
