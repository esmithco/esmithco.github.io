import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const notesDirectory = "notes";
const noteFiles = (await readdir(notesDirectory))
  .filter((file) => /\.html?$/i.test(file))
  .sort((a, b) => a.localeCompare(b));

const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
}[character]));

const entries = await Promise.all(noteFiles.map(async (file) => {
  const html = await readFile(join(notesDirectory, file), "utf8");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    .replace(/<[^>]+>/g, "").trim() || file.replace(/\.html?$/i, "");
  return { file, title };
}));

const cards = entries.map(({ file, title }, index) => `
      <a class="note-card" href="reader.html?note=${encodeURIComponent(file)}" aria-label="Read ${escapeHtml(title)}">
        <span class="note-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="note-title">${escapeHtml(title)}</span>
        <span class="note-action">Read →</span>
      </a>`).join("");

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Book Notes</title>
  <link rel="stylesheet" href="site.css">
</head>
<body>
  <main class="library">
    <a class="home-link" href="../">← Brian's home</a>
    <p class="eyebrow">Personal reading library</p>
    <h1>Book notes</h1>
    <p class="intro">${entries.length} note${entries.length === 1 ? "" : "s"}. Open one to read it like a document, then use arrows or swipe to move through the collection.</p>
    <section class="note-list" aria-label="Notes">${cards || "<p>No notes yet.</p>"}
    </section>
  </main>
</body>
</html>`;

await writeFile("index.html", page);
console.log(`Created index.html with ${entries.length} note(s).`);
