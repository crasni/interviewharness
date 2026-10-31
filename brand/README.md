# Brand

The mark is **passing the floor**: a solid dot, an open ring and the arc between them (ADR 0020). Colours are ink `#1a1a19` and stone `#f4f4f2`; nothing else.

## Files
| File | Use |
| --- | --- |
| `mark.svg` | The mark in ink on transparent, on a 100 grid. |
| `mark-stone.svg` | The mark in stone, for dark backgrounds. |
| `mark-small.svg` | Heavier cut for 32 px and under (favicons, tray). |
| `app-icon.svg` | Ink tile, stone mark. The default app icon. |
| `app-icon-light.svg` | Stone tile, ink mark. |
| `app-icon-small.svg` | Ink tile with the heavier cut, for 16 and 32 px. |
| `app-icon-macos.svg` | Ink tile on Apple's 1024 grid (824 body, inset 100). |
| `lockup.svg`, `lockup-stone.svg` | The mark and the name in Newsreader 500, outlined so it renders without the font. Stone is for dark backgrounds. |
| `png/` | App icon exports: 16 and 32 come from the small cut, 48 to 1024 from `app-icon.svg`, plus `app-icon-macos-1024.png`. |

`apps/desktop/resources/icon.png` is a copy of `png/app-icon-512.png`: the window icon.

## Rules
- Keep clear space around the mark equal to the ring's diameter.
- Use the small cut below 48 px; never scale the regular mark under 24 px.
- The mark is optically centred (shifted by −0.75, −4 on its grid). Centre the file, not the shapes.
- Don't recolour, outline, add shadows or gradients, rotate, or swap which side is solid.
- Keep it away from git branch and pull-request icons; next to them it can read as one.
