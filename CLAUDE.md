# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brayan Mendoza's personal static site, served by **GitHub Pages** as an organization page (`esmithco.github.io`) directly from the root of the `main` branch. There is **no build system, no framework, no package.json, no tests, no linter** — every page is hand-written static HTML/CSS/JS. Deploying is `git push`.

Independent sections, each self-contained:
- **`index.html` + `site.css`** — the personal home page (card grid linking to the sub-apps).
- **`fitness/index.html`** — the gym-routine app. A **single file** with all CSS and JS inline; state persists in `localStorage`.
- **`books/`** — a reading-notes library with a dynamic reader.
- **`aws/index.html`** — a standalone reference page (the AWS backend learning plan), in the grid-paper note style.
- **`ajedrez/`** — chess trainer (ES/EN): daily practice, repertoire, own mistakes, punish mistakes, key ideas. See "Chess trainer architecture" below.

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

Built Nov 2026 (rebuilt Nov 9) to replace/extend the Lotus Chess app. Brayan = Chess.com **Esmithco**, 10-min rapid; repertoire **London** (White), **Caro-Kann** vs 1.e4 and **Slav** (…d5/…c6) vs 1.d4 (Black). He wants it simple, daily, bilingual, and to understand *why* moves are good/bad (intuition, not "you lose in 40 moves").

Structure — one page, **hash-routed screens** (`#home` hub, `#train`, `#rep`, `#ideas`, `#data`; the *My mistakes* / *Punish* tiles have **no list screen** — they jump straight into 10 exercises, by request: board first, minimal text), all static:
- `index.html` — markup + CSS only (inline cburnett SVG piece sprite, CC BY-SA 3.0). Loads `chess.js`, `textos.js`, `repertorio.js`, `app.js` with `?v=` — **bump them when you change those files**.
- `app.js` — all logic. One shared trainer screen runs every exercise type: `card` (kind `mine` = your mistake, `punish` = opponent's mistake to punish), `line` (repertoire line; the app plays the opponent's moves — the user may leave the book: any move within 7 win-prob points of the engine's best is accepted and the game continues, opponent replies then come from `stats` (his real opponents' moves, weighted) or the engine, rejoining the book if a repertoire position recurs; only real mistakes are stopped), `idea` (key-idea lesson: `move` / `square` tap / `choice`), `name` ("which variation is this?" — final position of a line, pick its name). A never-seen repertoire line is first shown as a step-through demo with notes (◀ ▶ "Now play it"), then drilled. `tools/rep.py` refuses two different expected moves for the same position (the Lotus Chess ambiguity he disliked). Eval bar + arrows + an **analysis bar** under the board (`AN`, `anSet/anRender/anEval`): clickable move list + ⏮ ◀ ▶ ⏭ + "⟲ Exercise". Before answering you can step back through the game (board locked except at the exercise position); after answering (`itemDone` opens `cur.anPath()`) you can move pieces freely — moves branch/truncate like an analysis board, ◀ is undo, and the engine shows eval, best-move arrow and a quality chip for moves you try. "See the line" buttons load the line and let the user step with ▶ (no auto-animation — he found it too fast). "‹ Previous" in the trainer header goes back one exercise. Explanations are generated in JS from engine PVs (`explainBad`/`explainBest`: hanging piece, double attack/fork, mate, material lost, threat via null-move, simple heuristics: king pawns, early queen, same piece twice, pawn grab). **All displayed evals are from the player's perspective** (+ = good for you); the bar fill is White-from-bottom flipped with the board.
- `textos.js` — `TXT.es/en` UI strings (`t('key',…)`, `{0}` placeholders) + `IDEAS` (12 bilingual key-idea lessons; move answers were checked with Stockfish).
- `repertorio.js` — **generated** (`window.REP`) from `tools/rep.py` (bilingual notes per ply; `kind` main/trap/punish). Edit `rep.py`, then run it + `build.py`; `tools/verify.py` checks every repertoire move with Stockfish (depth 18).
- `datos.json` (~1.2 MB) — preloaded analysis: `{v:3, base:YYYYMMDD, games, cards, gambits, stats}`. `stats[posKey] = {san: count}` (move frequencies in his repertoire games, used for "they play this in N% of your games"). Merged into localStorage whenever `datos.base` > `S.base`, keeping progress (box/due/reps) for matching card ids.
- `chess.js` 0.10.3 (old API: `move(san,{sloppy:true})`, `in_checkmate()`… don't upgrade casually). `stockfish.asm.js` (Stockfish.js 10, Web Worker, jsDelivr fallback). **No backend**: engine runs in the browser; Chess.com public API is fetched directly (CORS ok).

State: `localStorage['taller-aperturas.v2']` (key kept for migration; `S.v=3`) = `{games, cards, gambits, rep:{"op:i":{box,due}}, ideas:{id:{box,due}}, daily:{date,items,idx,ok,done}, streak:{n,last}, base}`; language in `taller-aperturas.lang`. Card id = first 4 FEN fields + `|played` (mine) or `P|`+FEN (punish). Spaced repetition boxes 0–6 → `[0,1,3,7,16,35,80]` days; miss → box 1, 10 min.

App shell (Nov 9 evening): bottom **tab bar** (Hoy / Repertorio / Aprender / Progreso; hidden during exercises, which get a ✕ close button) — no more "← Inicio/← Taller" links. **Installable iPhone app (PWA)**: `manifest.webmanifest`, `icon-180/192/512.png`, `sw.js` (network-first for the page, cache-first for everything else → **bump `VER` in sw.js and the `?v=` of any changed asset, incl. `datos.json?v=`, or installed copies keep the old file**). A home-screen app has its OWN storage, separate from Safari (use Respaldo to move progress). **↻ Actualizar mis partidas** (home) fetches only months since the newest stored game and analyzes up to 40 new games in-browser. **Aprender** = `curso.js` (generated by `tools/curso.py` from the Lichess puzzle DB, CC0): 4 units/19 lessons of themed puzzles (~900→1700 rating, ordered by research: blunder-check/tactics first, then combinations, mating patterns, endgames) + 6 endgame-technique play-outs vs Stockfish (KQ/KR mate, K+P win/hold, Lucena, Philidor) + the 12 strategy IDEAS. A lesson shows its theory first. Puzzle FEN is *before* the opponent's move (Lichess format). **Fundamentos** (first Learn unit, `fundamentos.js`: `FUND` + `QUIZ`): timed drills — tap the named square / name the marked square (coords hidden via `.board.nocoords`, flips sides mid-round) / notation ("play Nxe4" ↔ "which move was played?", positions from his own card lines); records in `S.drill[id]={best,bestT}`; 22-question "what is…?" concept quiz (tactic vs strategy, notation symbols, pin vs skewer, zugzwang, opposition…) with SR in `S.quiz`. Daily practice starts with one drill (rotating by date) and includes one due quiz question. **Progreso**: rating line (rapid, last game per month; `games[].rt/tc`), mistakes per game per month (`games[].errors` = all flagged own moves, not just kept cards), first-try accuracy per week from `S.log` `[t, type, ok]`, mastery bars.

**Cloud save** (by request; free): progress syncs to a **private GitHub gist** (description `taller-aperturas-progress`, file `progress.json`) using a classic token with only the `gist` scope that the user pastes once per device (pre-filled link `github.com/settings/tokens/new?scopes=gist`). Token + gist id live in `localStorage['taller-aperturas.cloud']`, never in `S`/backups/the gist. Only *progress* is synced (`payload()`: SR state of practiced cards, rep/ideas/puz/tech, seenLesson, log, daily, streak, app-analysed games/cards — ~5 KB), not the base analysis. `save()` → push after 4 s; pull+merge on start and when the app returns to foreground (>60 s); push on hide (`keepalive`). Merge rule: per item keep the one with more `reps` (tie → later `due`); log = union.

Daily practice (`buildToday`): ~10 items — 1 repertoire line (trap/punish lines first; never-seen lines start as a demo), 3 puzzles from the current course lesson (+ its theory the first time) and 1 failed-puzzle review, 3 own mistakes, 1 punish (or a "which variation?" quiz), 1 key idea. Resumes mid-session; streak counter.

Criteria (same offline and in-app): **own move** flagged if win-probability (Lichess `wp(cp)`) drops ≥ 10 in one move within the first 30 plies and |eval before| ≤ 500; **punish** if the opponent's move drops ≥ 15 (|eval| ≤ 400). `trap` = good (≥ −200) → lost (≤ −300) in one move. No "lost game" requirement any more.

Regenerating `datos.json` offline (needs `brew install stockfish` + a venv with `pip install chess`; run from a scratch dir, **not** the repo): `tools/fetch.py` (all games via curl — Chess.com needs a User-Agent; python.org Python lacks certs) → `analyse.py` (depth 12 on every opening position, 7 processes, ~10 min) → `deep.py` (depth 16 PVs + null-move threats for selected positions) → `rep.py` → `build.py` → copy `datos.json` + `repertorio.js` into `ajedrez/`.

Findings (Nov 2026; 2,478 games): quick losses mostly from openings he dropped (1…e5, Scotch Gambit). Repertoire traps he fell for are encoded as trap lines (Caro Advance Bg5/…e6??, London …Nh5/g4?, Englund, Fantasy …Bg4?). Vs Queen's Gambit as Black he scored badly → Slav lines.

Ideas not done yet: a refresh button that re-downloads only new months; more key ideas drawn from his own middlegame blunders.

## Gotchas that have bitten before

- **`overflow-x: clip`, not `hidden`.** On the fitness page, `overflow-x: hidden` on `html,body` turns the body into a scroll container and **breaks `position: sticky`** (the pinned session timer) on iOS Safari. Use `overflow-x: clip`.
- **Cache-busting via query strings.** iOS caches HTML/CSS/JS aggressively. Shared assets are versioned (`site.css?v=2`, `reader.js?v=3`); when you change `books/site.css` or `books/reader.js`, **bump the `?v=` number** in every referencing page.
- **`apple-touch-icon` / favicons are inline SVG data-URIs** in each page's `<head>` (green "B" = home, purple book = book notes, blue dumbbell = fitness, violet knight = chess). Keep the rounded-square style consistent if adding sections.
