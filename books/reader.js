const noteFrame = document.querySelector("#note");
const position = document.querySelector("#position");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const menuButton = document.querySelector("#noteMenuBtn");
const menu = document.querySelector("#noteMenu");
const menuList = document.querySelector("#noteMenuList");
const menuBackdrop = document.querySelector("#noteMenuBackdrop");

const REL = "notes/fpp3";   // relative to reader.html (which lives in /books/)

let chapter = new URLSearchParams(location.search).get("chapter");
let manifest = null;     // { chapters: [{ name, notes:[...] }] }
let chapters = [];       // all chapter names, sorted
let chapterIndex = -1;   // where the current chapter sits in `chapters`
let availableNotes = [];
let current = 0;
let titleToken = 0;      // guards async title loads across chapter switches

// Chapters and notes come from a static manifest served by this site — no
// GitHub API, so no 60-req/hr rate limit and it works instantly + offline.
async function loadManifest() {
  const data = await fetch(`${REL}/manifest.json`)
    .then((r) => { if (!r.ok) throw new Error("manifest"); return r.json(); });
  data.chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return data;
}

function getNotes(chap) {
  if (!chap || !manifest) return [];
  const entry = manifest.chapters.find((c) => c.name === chap);
  if (!entry) return [];
  return entry.notes
    .slice()
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({ name, path: `${REL}/${chap}/${name}` }));
}

// reader.html lives in /books/, so paths are relative to it (already "books/"-free).
function notePathFor(file) {
  return file.path.split("/").map(encodeURIComponent).join("/");
}

const hasPrevChapter = () => chapterIndex > 0;
const hasNextChapter = () =>
  chapterIndex >= 0 && chapterIndex < chapters.length - 1;

function buildMenu() {
  menuList.innerHTML = "";

  availableNotes.forEach((file, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.index = index;
    button.innerHTML =
      `<span class="n">${String(index + 1).padStart(2, "0")}</span>` +
      `<span class="t">Note ${String(index + 1).padStart(2, "0")}</span>`;

    button.addEventListener("click", () => {
      showNote(index);
      closeMenu();
    });

    item.appendChild(button);
    menuList.appendChild(item);
  });

  menuButton.disabled = availableNotes.length === 0;
}

async function loadTitles() {
  const token = ++titleToken;
  const notes = availableNotes;

  await Promise.all(
    notes.map(async (file, index) => {
      try {
        const html = await fetch(notePathFor(file)).then((r) => r.text());
        const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (!match) return;

        const title = match[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!title) return;

        // A newer chapter switch happened — don't write into the new menu.
        if (token !== titleToken) return;

        const label = menuList.querySelector(
          `button[data-index="${index}"] .t`
        );
        if (label) label.textContent = title;
      } catch (error) {
        /* keep the fallback "Note NN" label */
      }
    })
  );
}

function updateMenuHighlight() {
  menuList.querySelectorAll("button").forEach((button) => {
    button.setAttribute(
      "aria-current",
      Number(button.dataset.index) === current ? "true" : "false"
    );
  });
}

function openMenu() {
  menu.hidden = false;
  menuBackdrop.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  updateMenuHighlight();
  menuList
    .querySelector('button[aria-current="true"]')
    ?.scrollIntoView({ block: "nearest" });
}

function closeMenu() {
  menu.hidden = true;
  menuBackdrop.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", () => {
  if (menu.hidden) openMenu();
  else closeMenu();
});

menuBackdrop.addEventListener("click", closeMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

function showNote(index, replace = false) {
  current = Math.max(0, Math.min(index, availableNotes.length - 1));

  const file = availableNotes[current];
  if (!file) {
    location.replace("chapters.html");
    return;
  }

  noteFrame.src = notePathFor(file);
  position.textContent = `${current + 1} / ${availableNotes.length}`;

  previous.disabled = current === 0 && !hasPrevChapter();
  next.disabled = current === availableNotes.length - 1 && !hasNextChapter();

  updateMenuHighlight();

  history[replace ? "replaceState" : "pushState"](
    {},
    "",
    `reader.html?chapter=${encodeURIComponent(chapter)}`
  );
}

// Load a different chapter and land on its first ("first") or last ("last") note.
function switchChapter(newIndex, landing) {
  const notes = getNotes(chapters[newIndex]);
  if (!notes.length) return;

  chapter = chapters[newIndex];
  chapterIndex = newIndex;
  availableNotes = notes;

  buildMenu();
  loadTitles();
  showNote(landing === "last" ? availableNotes.length - 1 : 0, false);
}

// One step forward / back, crossing chapter boundaries when needed.
function go(delta) {
  const target = current + delta;

  if (target < 0) {
    if (hasPrevChapter()) switchChapter(chapterIndex - 1, "last");
    return;
  }
  if (target >= availableNotes.length) {
    if (hasNextChapter()) switchChapter(chapterIndex + 1, "first");
    return;
  }
  showNote(target);
}

previous.addEventListener("click", () => go(-1));
next.addEventListener("click", () => go(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") go(-1);
  if (event.key === "ArrowRight") go(1);
});

let swipeStart = null;

noteFrame.addEventListener("load", () => {
  const documentBody = noteFrame.contentDocument?.body;

  documentBody?.addEventListener(
    "touchstart",
    (event) => {
      swipeStart = event.changedTouches[0].screenX;
    },
    { passive: true }
  );

  documentBody?.addEventListener(
    "touchend",
    (event) => {
      if (swipeStart === null) return;
      const distance = event.changedTouches[0].screenX - swipeStart;
      if (Math.abs(distance) > 80) go(distance < 0 ? 1 : -1);
      swipeStart = null;
    },
    { passive: true }
  );
});

// --- Boot ---
try {
  manifest = await loadManifest();
  chapters = manifest.chapters.map((c) => c.name);
} catch (error) {
  manifest = { chapters: [] };
  chapters = [];
}
chapterIndex = chapters.indexOf(chapter);
availableNotes = getNotes(chapter);

buildMenu();
loadTitles();
showNote(current, true);
