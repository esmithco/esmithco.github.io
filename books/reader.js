const noteFrame = document.querySelector("#note");
const position = document.querySelector("#position");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const menuButton = document.querySelector("#noteMenuBtn");
const menu = document.querySelector("#noteMenu");
const menuList = document.querySelector("#noteMenuList");
const menuBackdrop = document.querySelector("#noteMenuBackdrop");

const OWNER = "ESMITHCO";
const REPO = "ESMITHCO.github.io";

async function getNotes() {
  const chapter =
    new URLSearchParams(location.search).get("chapter");

  if (!chapter) {
    return [];
  }

  const folder = `books/notes/fpp3/${chapter}`;

  const url =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/` +
    folder
      .split("/")
      .map(encodeURIComponent)
      .join("/");

  const files = await fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("Could not load chapter.");
    }

    return response.json();
  });

  return files
    .filter((file) =>
      file.type === "file" &&
      file.name.toLowerCase().endsWith(".html")
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true
      })
    );
}

const availableNotes = await getNotes();

let current = 0;

/*
  file.path is something like:
    books/notes/fpp3/chap 1/forecasting-ch1-01.html
  reader.html is inside /books/, so remove "books/".
*/
function notePathFor(file) {
  return file.path
    .replace(/^books\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

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
  await Promise.all(
    availableNotes.map(async (file, index) => {
      try {
        const html = await fetch(notePathFor(file)).then((r) => r.text());
        const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

        if (!match) return;

        const title = match[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        if (!title) return;

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
  current = Math.max(
    0,
    Math.min(index, availableNotes.length - 1)
  );

  const file = availableNotes[current];

  if (!file) {
    location.replace("chapters.html");
    return;
  }

  noteFrame.src = notePathFor(file);

  position.textContent =
    `${current + 1} / ${availableNotes.length}`;

  previous.disabled = current === 0;
  next.disabled =
    current === availableNotes.length - 1;

  updateMenuHighlight();

  const chapter =
    new URLSearchParams(location.search).get("chapter");

  history[
    replace ? "replaceState" : "pushState"
  ](
    {},
    "",
    `reader.html?chapter=${encodeURIComponent(chapter)}`
  );
}

previous.addEventListener("click", () => {
  showNote(current - 1);
});

next.addEventListener("click", () => {
  showNote(current + 1);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    showNote(current - 1);
  }

  if (event.key === "ArrowRight") {
    showNote(current + 1);
  }
});

let swipeStart = null;

noteFrame.addEventListener("load", () => {
  const documentBody =
    noteFrame.contentDocument?.body;

  documentBody?.addEventListener(
    "touchstart",
    (event) => {
      swipeStart =
        event.changedTouches[0].screenX;
    },
    { passive: true }
  );

  documentBody?.addEventListener(
    "touchend",
    (event) => {
      if (swipeStart === null) return;

      const distance =
        event.changedTouches[0].screenX -
        swipeStart;

      if (Math.abs(distance) > 80) {
        showNote(
          current +
          (distance < 0 ? 1 : -1)
        );
      }

      swipeStart = null;
    },
    { passive: true }
  );
});

buildMenu();
loadTitles();
showNote(current, true);