# Fighter Sprite Assets

Drop transparent PNGs here and `FighterSprite.tsx` picks them up automatically — no code change needed.

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

Currently the sprite uses `idle.png` for ALL poses and animates via CSS transforms. Drop pose-specific PNGs later if you want richer animation.

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

Missing PNG → component renders the procedural SVG chibi (see `FighterSprite.tsx`) so the game never breaks during development. Add files one at a time; each character upgrades independently.

## Generating images

See `docs/firefly-prompts.md` for 6 prompts ready to copy-paste into Adobe Firefly (commercial-license safe). Same workflow works for Midjourney / Leonardo / Stable Diffusion — adjust style anchor as needed.

## Workflow

1. Generate / commission PNG for one character (start with `haneul/idle.png`)
2. Drop into `web/public/fighters/haneul/idle.png`
3. Reload the page — that character now uses the image; others stay on SVG
4. Repeat per character
