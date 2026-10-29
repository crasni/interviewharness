# The "Editorial" identity replaces strict black and white

v0.0 took "black and white" literally (pure #000 on #fff, black rules everywhere, square corners, all-caps labels) and the owner found it plain, closer to brutalist than to the modern minimal of the ChatGPT and Claude apps. After comparing seven variants side by side (research in `docs/research/07-ui-direction.md`, prototypes on the `prototype/room-palette` branch), the owner picked **Editorial**: Newsreader serif for the interviewer's voice and titles, Geist for the interface, Geist Mono for code, on a cool stone neutral (`#F4F4F2` light, `#191918` dark) with soft surfaces, light hairlines, radius by role, sentence-case labels and light/dark following the system. It stays monochrome with no accent colour, and deliberately avoids Claude's own identity (cream, terracotta, Tiempos).

The owner expects to revise it, so every colour, font and shape is a role token in `apps/desktop/src/renderer/src/ui/tokens.css`; components use only the role names.

## Considered options

- **Pure black and white, refined** (rounded, sentence case): still read as stark.
- **Cool neutral, ChatGPT-like** and **warm neutral, Claude-like**: liked, but too close to someone else's product.
- **Engineer's notebook** (IBM Plex, slate) and **Modern grotesk** (Instrument, true neutral): own identities, not chosen for now.
