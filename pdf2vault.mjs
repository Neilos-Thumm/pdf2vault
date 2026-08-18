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
const DPI = 100; // 100 is legible for bullet slides; bump to 150 for dense diagrams
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

const slug = slugArg
  ? slugify(slugArg)
  : slugify(basename(pdfPath, extname(pdfPath)));

const pastedDir = join(VAULT, PASTED, slug);
const notesDir = join(VAULT, NOTES);
mkdirSync(pastedDir, { recursive: true });
mkdirSync(notesDir, { recursive: true });

// 1. rasterize: pdftoppm writes <prefix>-01.png, <prefix>-02.png, ...
const result = spawnSync(
  "pdftoppm",
  ["-png", "-r", String(DPI), pdfPath, join(pastedDir, slug)],
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
const embeds = pages.map((f) => `![[${f}]]`).join("\n");
const note = `---
date: ${today}
source: ${basename(pdfPath)}
pages: ${pages.length}
---

${embeds}
`;

const notePath = join(notesDir, `${slug}.md`);
if (existsSync(notePath)) die(`note already exists: ${notePath}`);
writeFileSync(notePath, note, "utf8");

console.log(`${pages.length} pages -> ${PASTED}/${slug}/${slug}-NN.png`);
console.log(`note written    -> ${NOTES}/${slug}.md`);
