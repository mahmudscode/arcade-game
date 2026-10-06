# Legal and IP Notes

> Engineering guidance, not legal advice. Get a lawyer's review before public launch.

## Risk
The catalog lists famous commercial games. Game **mechanics and rules** are generally not protected by copyright, but the following are:
- Names and logos (trademarks): "Pac-Man", "Donkey Kong", "Tetris", "Street Fighter", etc.
- Characters, artwork, sprites, level layouts, music and sound.
- Source code and ROMs.
Some owners actively enforce (e.g. Tetris Company, Nintendo, Namco/Bandai).

## Policy for this project
1. **Original assets only.** All sprites, sound and music are created in-house or from permissively licensed sources (CC0 / MIT) with attribution tracked in `ASSETS.md`.
2. **No ROMs, no emulation.** Every game is a fresh implementation.
3. **Public titles may differ from the catalog names.** Use homage names and original characters where the title is a known trademark (e.g. "Block Drop" for Tetris, "Dot Muncher" for Pac-Man). Keep `slug` internal; keep a `public_title` column if renamed.
4. Public-domain / generic games (Pong-style, Snake, Sokoban, Breakout-style, Simon-style, Minesweeper-like) may keep generic names where no trademark applies; still verify.
5. No claims of affiliation: no "official", no original logos, no original character likenesses, no distinctive trade dress (maze layouts and ghost designs for Pac-Man, barrel/ape/plumber for Donkey Kong).
6. Add a footer: "Inspired by classic arcade games. Not affiliated with or endorsed by any original publisher."
7. Respond to takedown notices quickly: `enabled=false` flag per game in the `games` table.

## Other obligations
- Privacy policy and terms (accounts, cookies, leaderboards display usernames publicly).
- GDPR/CCPA: data export and account deletion endpoints (add before launch).
- COPPA: do not target children under 13; no ads/tracking without consent.
- Third-party licenses: track dependency licenses (`pnpm licenses list`) in CI.
