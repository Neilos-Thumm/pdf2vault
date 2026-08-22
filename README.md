# pdf2vault

Turns a lecture PDF into one Obsidian note with every slide embedded as an image, in order.

## What's the point?

The excruciating labour I need to do every single lecture is: open the PDF, screenshot a slide, paste into Obsidian, scroll, repeat forty times. This does the same thing in one command, but better:

- **Right-sized images.** A screenshot is stuck at your display resolution. Rendering at 100 DPI gives ~1334px wide slides — legible and noticeably smaller than a Retina screenshot.
- **No PDF bloat carried over.** Fonts, metadata, hidden layers, embedded JS — none of that survives rasterization to PNG. A test deck went from 18.6 MB to 3.2 MB.
- **Sane filenames.** `lec03-1.png` sorts correctly, tells you which deck it's from, and won't collide with a real pasted screenshot.

### Tradeoff

Slides become images, so Obsidian search can't see the text on them. If you need that, pipe `pdftotext -layout` into the note inside a `%%` comment block — hidden in preview, still searchable.

## Stack

Plain Node.js (`.mjs`, no dependencies) driving `pdftoppm` from Poppler. No plugin, no bundler — writing PNGs into the vault folder *is* the import; Obsidian's file watcher picks them up immediately.

## Install

```sh
brew install poppler          # provides pdftoppm
```

Point the script at your vault — edit line 10, or set an env var:

```sh
export VAULT="/Users/you/Documents/MyVault"
alias slides='node ~/scripts/pdf2vault.mjs'
```

## Demo
https://github.com/user-attachments/assets/da56449c-ba72-44d9-9786-c7963286c059

## Run

```sh
slides ~/Downloads/lec03.pdf              # slug taken from the filename
slides ~/Downloads/lec03.pdf week-3-tcp   # explicit slug
```

```
40 pages -> Pasted/lec03/lec03-01.png
note written    -> Notes/lec03.md
```

## Layout

```
<VAULT>/
├── Notes/
│   └── lec03.md
└── Pasted/
    └── lec03/
        ├── lec03-01.png
        └── lec03-02.png
```

Both folders get created automatically. The note itself:

```markdown
---
date: 2026-08-18
source: lec03.pdf
pages: 40
---

![[lec03-01.png]]
![[lec03-02.png]]
```

## Re-running on the same deck

Nothing gets overwritten — a second run appends `(1)`, a third `(2)`, applied consistently to the note, folder, and image filenames:

```
Notes/lec03.md      →  Pasted/lec03/lec03-01.png
Notes/lec03(1).md   →  Pasted/lec03(1)/lec03(1)-01.png
```

(This has to include the filenames too, not just the folder — Obsidian resolves `![[...]]` embeds by filename alone, so two decks with identically-named images would clash.)

## Configuration

Lines 10–13:

| Constant | Default | Notes |
|---|---|---|
| `VAULT` | env `VAULT` | Absolute path. Overridden by the environment variable. |
| `PASTED` | `"Pasted"` | Image root; each deck gets a subfolder. |
| `NOTES` | `"Notes"` | Where the note lands. |
| `DPI` | `100` | ~1334px wide. Bump to 150 for dense diagrams or small print. |

## Optional: shrink further

`pngquant` cuts flat slide content by roughly 60% with no visible difference, and skips photographic pages automatically:

```sh
pngquant --quality=65-90 --skip-if-larger --ext .png --force Pasted/**/*.png
```

## Other flags worth knowing

- `-hide-annotations` — drops highlights and sticky-note icons that Poppler otherwise renders by default.
- `-jpeg -jpegopt quality=85` — better than PNG for decks that are mostly photos.

## Exit codes

`0` on success. `1` with a message on stderr for: missing argument, PDF not found, `pdftoppm` missing or failing, no pages produced, or 100 versions already existing.
