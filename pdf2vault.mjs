#!/usr/bin/env node
// pdf2vault.mjs — turn a lecture PDF into per-page images + an Obsidian note.
// Usage: node pdf2vault.mjs <file.pdf> [slug]

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

// ---- config -----------------------------------------------------------
const VAULT = process.env.VAULT ?? "/Users/parunthummadetsak/Documents/Obsidian/Local Vault";
const PASTED = "Pasted";
const NOTES = "Notes";
// Render to a fixed pixel width instead of a fixed DPI. DPI depends on the
// PDF's physical page size: PowerPoint slides are 720pt wide (-> 1000px at
// 100 DPI) but Beamer slides are ~363pt wide (-> ~500px), which then got
// upscaled to WIDTH in Obsidian and looked blurry.

// const RENDER_PX = 1650; // ~2x WIDTH so it stays sharp on Retina screens
const RENDER_PX = 1240; // ~1.5x WIDTH so it stays sharp on Retina screens
const WIDTH = 825; // display width in the note
// -----------------------------------------------------------------------

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

const [, , pdfArg, slugArg] = process.argv;
if (!pdfArg) die("usage: node pdf2vault.mjs <file.pdf> [slug]");

const pdfPath = resolve(pdfArg);
if (!existsSync(pdfPath)) die(`no such file: ${pdfPath}`);

const base = slugArg
  ? slugify(slugArg)
  : slugify(basename(pdfPath, extname(pdfPath)));

const notesDir = join(VAULT, NOTES);

// find the first name where BOTH the note and the image folder are free,
// so a versioned run never writes into a previous run's image folder
const firstFreeName = (stem) => {
  for (let n = 0; n < 100; n++) {
    const name = n === 0 ? stem : `${stem}(${n})`;
    const noteFree = !existsSync(join(notesDir, `${name}.md`));
    const dirFree = !existsSync(join(VAULT, PASTED, name));
    if (noteFree && dirFree) return name;
  }
  die(`100 versions of "${stem}" already exist — tidy up or pass a new slug`);
};

const slug = firstFreeName(base);
const pastedDir = join(VAULT, PASTED, slug);
const notePath = join(notesDir, `${slug}.md`);

mkdirSync(pastedDir, { recursive: true });
mkdirSync(notesDir, { recursive: true });

// 1. rasterize: pdftoppm writes <prefix>-01.png, <prefix>-02.png, ...
const result = spawnSync(
  "pdftoppm",
  [
    "-png",
    "-scale-to-x", String(RENDER_PX),
    "-scale-to-y", "-1", // keep aspect ratio
    pdfPath,
    join(pastedDir, slug),
  ],
  { stdio: "inherit" },
);

if (result.error?.code === "ENOENT")
  die("pdftoppm not found — install poppler (see setup notes)");
if (result.status !== 0) die(`pdftoppm exited with code ${result.status}`);

// 2. collect the pages it just produced
const pages = readdirSync(pastedDir)
  .filter((f) => f.startsWith(`${slug}-`) && f.endsWith(".png"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (pages.length === 0) die("no pages were produced");

// 3. build the note
const today = new Date().toISOString().slice(0, 10);
const embeds = pages
  .map((f) => (WIDTH ? `![[${f}|${WIDTH}]]` : `![[${f}]]`))
  .join("\n");
const note = `---
date: ${today}
source: ${basename(pdfPath)}
pages: ${pages.length}
---

${embeds}
`;

writeFileSync(notePath, note, "utf8");

console.log(`${pages.length} pages -> ${PASTED}/${slug}/${slug}-NN.png`);
console.log(`note written    -> ${NOTES}/${slug}.md`);
