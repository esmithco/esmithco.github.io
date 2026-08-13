const noteFrame = document.querySelector("#note");
const position = document.querySelector("#position");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
async function getNotes() {
  const documentHtml = await fetch("index.html").then((response) => response.text());
  return [...new DOMParser().parseFromString(documentHtml, "text/html").querySelectorAll(".note-card")]
    .map((card) => new URL(card.href).searchParams.get("note"));
}

const availableNotes = await getNotes();
const requestedNote = new URLSearchParams(location.search).get("note");
let current = Math.max(0, availableNotes.indexOf(requestedNote));

function showNote(index, replace = false) {
  current = Math.max(0, Math.min(index, availableNotes.length - 1));
  const file = availableNotes[current];
  if (!file) { location.replace("index.html"); return; }
  noteFrame.src = `notes/${file}`;
  position.textContent = `${current + 1} / ${availableNotes.length}`;
  previous.disabled = current === 0;
  next.disabled = current === availableNotes.length - 1;
  history[replace ? "replaceState" : "pushState"]({}, "", `reader.html?note=${encodeURIComponent(file)}`);
}

previous.addEventListener("click", () => showNote(current - 1));
next.addEventListener("click", () => showNote(current + 1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showNote(current - 1);
  if (event.key === "ArrowRight") showNote(current + 1);
});
let swipeStart = null;
noteFrame.addEventListener("load", () => {
  const documentBody = noteFrame.contentDocument?.body;
  documentBody?.addEventListener("touchstart", (event) => { swipeStart = event.changedTouches[0].screenX; }, { passive: true });
  documentBody?.addEventListener("touchend", (event) => {
    if (swipeStart === null) return;
    const distance = event.changedTouches[0].screenX - swipeStart;
    if (Math.abs(distance) > 80) showNote(current + (distance < 0 ? 1 : -1));
    swipeStart = null;
  }, { passive: true });
});
showNote(current, true);
