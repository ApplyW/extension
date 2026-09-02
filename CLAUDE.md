# CLAUDE.md

Guidance for Claude when working in this codebase.

## Stack

- **Language**: TypeScript
- **Build**: Vite + `@crxjs/vite-plugin` (CRXJS)
- **Platform**: Chrome Extension, Manifest V3
- **Scope today**: content script only (`https://www.linkedin.com/jobs/*`) — no popup, no background service worker yet
- **Persistence**: `chrome.storage.local`

## Running tasks

```bash
npm install
npm run dev      # Vite dev server with HMR for the content script
npm run build    # outputs to dist/
```

Load `dist/` as an unpacked extension via `chrome://extensions` (Developer mode) to verify changes in a real page.

## Structure

- `manifest.config.ts` — MV3 manifest via CRXJS's `defineManifest`. Keep `content_scripts.matches` and `permissions` as narrow as possible; currently just the LinkedIn jobs path and the `storage` permission.
- `vite.config.ts` — wires the `crx()` plugin to that manifest.
- `src/content/index.ts` — entry point: initial scan of job cards, then a `MutationObserver` (debounced) rescans as new cards load in on infinite scroll.
- `src/content/jobCard.ts` — DOM layer: reads a card's `data-occludable-job-id`, injects the Hide button into LinkedIn's own `.job-card-list__actions-container`, applies hidden state.
- `src/content/storage.ts` — `chrome.storage.local` read/write for the set of hidden job ids.

Selectors here are copied from real LinkedIn markup, not guessed — if a selector stops matching (LinkedIn changed the DOM), ask for a fresh `outerHTML` sample of the affected card rather than guessing a replacement.

## Test suites

None yet — nothing here has automated tests.

## Code style

Keep comments brief; only comment where the logic isn't self-explanatory (e.g. why a debounce exists, why a specific attribute is used as the id).

## Configuration

No config/secrets file exists yet. If one is added, it must never be committed — wire it into `.gitignore` immediately.

## Commit conventions

Commit directly on `main` — don't create a feature branch per change unless asked to.

Conventional Commits format: `<type>[optional scope][optional !]: <description>`

Types:
- `feat` — new feature
- `fix` — bug fix
- `refactor` — neither a fix nor a feature
- `perf` — performance improvement
- `test` — adding or correcting tests
- `docs` — documentation only
- `style` — formatting, whitespace, no logic change
- `build` — build system or dependency changes
- `ci` — CI/CD configuration changes

`!` after type/scope marks a breaking change.

Description: imperative present tense ("add" not "added"), state the intention not the implementation,
include ticket number if there is one.

Body: motivation and contrast with previous behavior, same tense rules.

Footer: breaking change details, ticket/issue links. If the commit was largely AI-assisted, note it here.

Example:
```
feat(content-script): hide job cards and persist across reloads

Injects a Hide button into each job card's action bar. Hidden job ids are
stored in chrome.storage.local so cards stay hidden after a reload, and a
MutationObserver re-applies hidden state as infinite scroll loads new cards.

Co-authored-with: Claude (Anthropic)
```
