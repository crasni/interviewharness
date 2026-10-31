# The mark: passing the floor

The app needed one icon for everywhere: the app icon, the window, the README and a future landing page. The owner compared about sixty sketches over several rounds: geometric, woven knots, line fields, delicate line marks and bold marks with interview cues. They picked **passing the floor**: a solid dot, an open ring, and a heavy arc from one to the other. The speaker with the floor hands the turn to the open seat. It's the Floor Manager's job in one picture, and it stays readable at 16 px.

## The decisions
- **Optically centred, not centred by its box.** The solid dot outweighs the ring, so the first draft leaned left and sat low (its ink centred at 47.5, 56.4 on the 100 grid). The ring is a little larger and heavier (r 9, stroke 6) and the dot a little smaller (r 10.5). The whole mark is shifted by (−0.75, −4), which puts its box at y 49 and its ink at (49.0, 52.8).
- **Ink and stone only**: `#1a1a19` and `#f4f4f2`, the light theme's ink and canvas (ADR 0015). There's no accent colour.
- **A heavier cut for small sizes**: at 32 px and under, the strokes thicken and the mark grows 10%, so the ring's hole and the arc survive.
- **On a Mac** the tile sits on Apple's 1024 grid (an 824 body, inset 100), since macOS doesn't mask app icons. Everywhere else the tile fills its square.
- **The wordmark is Newsreader 500**, the identity's voice and title face, set beside the mark and outlined so it renders anywhere. (Mona Sans 600 was the alternative.)
- **`.icns` and `.ico` come with packaging**, made from these sources.
- Sources and rules live in `brand/` (see its README). The window shows the icon in development on all three systems; packaged builds take it from `brand/png` once packaging exists.

## Checked against
Shape similarity against all 3,291 brand logos in Simple Icons 15.0.0 and the Lucide, Tabler and Material icon sets found nothing close. The nearest are arch shapes (Expo, Redmine) and Asana's dots. The one family it resembles is git pull-request icons (circles joined by lines), so it shouldn't sit next to them in the UI. No trademark search was done.

## Considered options
- **Woven knots** (trefoil, Borromean): they overfit the reference the owner gave (OpenAI's mark).
- **Line fields** (stripes bending around an empty circle, a hidden circle): striking, but too complex and blurry under 32 px.
- **Hot seat** (a chair cut out of a disc, also an h): a close second.
