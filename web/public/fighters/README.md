# Fighter Sprite Assets

This folder contains the playable fighter PNG roster. Keep the existing
character silhouettes and poses, but only ship art that has passed the
IP-clearance checklist.

## Folder layout

```
web/public/fighters/
├── haneul/
│   ├── idle.png       ← REQUIRED (enables images for this character)
│   ├── windup.png     ← optional (charging an attack)
│   ├── impact.png     ← optional (striking)
│   ├── hit.png        ← optional (taking damage)
│   ├── ko.png         ← optional (collapsed)
│   └── victory.png    ← optional (winning pose)
├── bora/idle.png
├── taeyang/idle.png
├── danbi/idle.png
├── seokjin/idle.png
└── yuri/idle.png
```

`idle.png` can be used for all poses and animated via CSS transforms. Drop
pose-specific PNGs when you want richer animation.

## Required image specs

| Property | Recommendation |
|---|---|
| Format | PNG, transparent background |
| Width | 512px or larger (auto-scales down) |
| Aspect | ~9:16 portrait (taller than wide — full body) |
| Direction | Character facing RIGHT (`flip` prop mirrors for opponent side) |
| Margin | ~10% padding around the character on all sides |
| Color profile | sRGB |

## Fallback behavior

Missing PNG → component renders the procedural SVG chibi (see `FighterSprite.tsx`) so the game never breaks during development. The service UI should use `assetMode="auto"` for the main roster.

## Generating images

See `docs/firefly-prompts.md` for six IP-cleared prompt specs. Do not reference
existing anime, manga, games, films, comics, studios, or named characters in
prompts, source filenames, alt text, commits, or documentation.

## Workflow

1. Generate / commission or retouch PNG for one character (start with `haneul/idle.png`)
2. Drop into `web/public/fighters/haneul/idle.png`
3. Review silhouette, outfit, color combo, prompt text, and metadata for IP risk
4. Keep the consuming component on `assetMode="auto"`
5. Reload the page — that character now uses the image
6. Repeat per character
