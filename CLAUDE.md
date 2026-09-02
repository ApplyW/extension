# CLAUDE.md

Guidance for Claude when working in this codebase.

## Stack

- **Language**: TypeScript
- **Build**: Vite + `@crxjs/vite-plugin` (CRXJS)
- **Platform**: Chrome Extension, Manifest V3
- **Scope today**: content script (`https://www.linkedin.com/jobs/*`) + a React popup — no background service worker yet
- **UI**: React 19, only used for the popup (`src/popup/`); the content script stays framework-free DOM manipulation
- **Persistence**: `chrome.storage.local`, capped at 10 MB without the `unlimitedStorage` permission (not requested) — not a practical constraint for this data (short id/company strings)

## Running tasks

```bash
npm install
npm run dev      # Vite dev server with HMR for the content script
npm run build    # outputs to dist/
```

Load `dist/` as an unpacked extension via `chrome://extensions` (Developer mode) to verify changes in a real page.

## Structure

- `manifest.config.ts` — MV3 manifest via CRXJS's `defineManifest`. Keep `content_scripts.matches` and `permissions` as narrow as possible; currently just the LinkedIn jobs path and the `storage` permission.
- `vite.config.ts` — wires the `@vitejs/plugin-react` and `crx()` plugins to that manifest.
- `src/shared/storage.ts` — `chrome.storage.local` read/write, shared by the content script and the popup. Company names are stored normalized (trimmed, lowercased) for matching, so the popup currently displays them lowercased too — known rough edge, not fixed. Also holds `Settings` (`hideApplied`/`hideViewed`), one JSON object under a single key rather than the get/add/remove-set pattern used for hidden jobs/blocked companies.
- `src/content/index.ts` — entry point: initial scan of job cards, a `MutationObserver` (debounced) that rescans on any DOM change (LinkedIn virtualizes/recycles cards, so this can't be limited to "new card appeared"), and a `chrome.storage.onChanged` listener so popup edits (e.g. unblocking a company) take effect without a page reload.
- `src/content/jobCard.ts` — DOM layer: reads a card's `data-occludable-job-id`, company name (`.artdeco-entity-lockup__subtitle`), and footer state badges (`.job-card-container__footer-item`, e.g. "Viewed"/"Applied") matched by text since only "Viewed" has been seen in real markup; injects Hide/Block buttons into LinkedIn's own `.job-card-list__actions-container`, applies hidden state. Button injection is guarded by checking the live actions container for its own button, not a flag on the card — flags on the card would survive LinkedIn's content-recycling and skip re-injection.
- `src/content/filterBar.ts` — `findFilterBar()`, the shared "locate LinkedIn's top filter bar via an existing filter pill" lookup used by both `filterToggles.ts` and `languageFilter.ts`.
- `src/content/filterToggles.ts` — injects "Hide Applied"/"Hide Viewed" pills into LinkedIn's own top filter bar (Date Posted, Experience level, Easy Apply, ...), styled to match by reusing LinkedIn's own `artdeco-pill`/`search-reusables__filter-*` markup and classes.
- `src/content/language.ts` — wraps `chrome.i18n.detectLanguage` (confirmed available in content scripts, no manifest permission needed) with an in-memory cache keyed by job id, since detection is async and cards get rescanned often.
- `src/content/languageFilter.ts` — injects a "Language" filter pill + dropdown (search box, checkbox list, Cancel/Apply) into the same filter bar, mirroring LinkedIn's own dropdown-style filters (e.g. Company). Detection only runs on the card's title — the search-results list never renders a job description, only the detail view does, so there's no fuller text to detect against; treat it as a heuristic on a short string, not a reliable signal. The dropdown panel is custom-styled, not a clone of `artdeco-hoverable-content` — that component's position is computed by LinkedIn's own JS, which we don't have.
- `src/popup/` — `index.html` + `main.tsx` (mount) + `Popup.tsx` (lists blocked companies with an Unblock action, shows/clears the hidden-jobs count) + `popup.css`.

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
