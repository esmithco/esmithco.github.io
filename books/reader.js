const noteFrame = document.querySelector("#note");
const position = document.querySelector("#position");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");

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

  /*
    file.path is something like:

    books/notes/fpp3/chap 1/forecasting-ch1-01.html

    reader.html is inside /books/, so remove "books/".
  */

  const notePath = file.path
    .replace(/^books\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  noteFrame.src = notePath;

  position.textContent =
    `${current + 1} / ${availableNotes.length}`;

  previous.disabled = current === 0;
  next.disabled =
    current === availableNotes.length - 1;

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

showNote(current, true);