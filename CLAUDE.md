# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brayan Mendoza's personal static site, served by **GitHub Pages** as an organization page (`esmithco.github.io`) directly from the root of the `main` branch. There is **no build system, no framework, no package.json, no tests, no linter** — every page is hand-written static HTML/CSS/JS. Deploying is `git push`.

Three independent sections, each self-contained:
- **`index.html` + `site.css`** — the personal home page (links out to the two apps).
- **`fitness/index.html`** — the gym-routine app. A **single file** with all CSS and JS inline; state persists in `localStorage`.
- **`books/`** — a reading-notes library with a dynamic reader.

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

## Gotchas that have bitten before

- **`overflow-x: clip`, not `hidden`.** On the fitness page, `overflow-x: hidden` on `html,body` turns the body into a scroll container and **breaks `position: sticky`** (the pinned session timer) on iOS Safari. Use `overflow-x: clip`.
- **Cache-busting via query strings.** iOS caches HTML/CSS/JS aggressively. Shared assets are versioned (`site.css?v=2`, `reader.js?v=3`); when you change `books/site.css` or `books/reader.js`, **bump the `?v=` number** in every referencing page.
- **`apple-touch-icon` / favicons are inline SVG data-URIs** in each page's `<head>` (green "B" = home, purple book = book notes, blue dumbbell = fitness). Keep the rounded-square style consistent if adding sections.
