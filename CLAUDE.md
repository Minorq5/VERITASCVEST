@AGENTS.md

# Veritas Tasks — notes for coding agents

- Start every session by reading `PROGRESS.md` (current stage, decisions, known issues), then `PLAN.md` section 19 (owner's mandatory amendments).
- Talk to the owner in Russian, plain language; they are not a programmer.
- Never touch the owner's existing Supabase projects "VeritasBio" and "Minorq5's Project". Only the project `veritas-tasks` (Frankfurt) may be used, and only from the end of stage 3.
- All UI text goes through `src/messages/{ru,en,bg}.json`; `npm test` checks key parity and typography.
- Design tokens live in `src/styles/globals.css`; the default Tailwind palette is removed on purpose.
- Before committing a stage: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:e2e`, `npm run build`, screenshots + `DESIGN_REVIEW.md`, update `PROGRESS.md`.
- CSS: write only the standard `backdrop-filter` (never a hand-written `-webkit-` copy); noise textures need `stitchTiles` and a filter region equal to the tile. `tests/unit/css.test.ts` enforces both.
- Never `pkill -f <pattern>` when the pattern also appears in your own command line: it kills your shell. Kill by PID or port.
