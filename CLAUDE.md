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

- `manifest.config.ts` — MV3 manifest via CRXJS's `defineManifest`. Keep `content_scripts.matches` and `permissions` as narrow as possible; currently just the LinkedIn jobs path and the `storage` permission. Declares two content scripts on the same path: the regular ISOLATED-world one (`index.ts`) and a MAIN-world one (`pageBridge.ts`, `document_start`) — see that file for why.
- `vite.config.ts` — wires the `@vitejs/plugin-react` and `crx()` plugins to that manifest.
- `src/shared/storage.ts` — `chrome.storage.local` read/write, shared by the content script and the popup. Company names are stored normalized (trimmed, lowercased) for matching, so the popup currently displays them lowercased too — known rough edge, not fixed. Also holds `Settings` (`hideApplied`/`hideViewed`), one JSON object under a single key rather than the get/add/remove-set pattern used for hidden jobs/blocked companies.
- `src/content/index.ts` — entry point: initial scan of job cards, a `MutationObserver` (debounced) that rescans on any DOM change (LinkedIn virtualizes/recycles cards, so this can't be limited to "new card appeared"), and a `chrome.storage.onChanged` listener so popup edits (e.g. unblocking a company) take effect without a page reload.
- `src/content/jobCard.ts` — DOM layer: reads a card's `data-occludable-job-id`, company name (`.artdeco-entity-lockup__subtitle`), and footer state badges (`.job-card-container__footer-item`, e.g. "Viewed"/"Applied") matched by text since only "Viewed" has been seen in real markup; injects Hide/Block buttons into LinkedIn's own `.job-card-list__actions-container`, applies hidden state, and renders the detected-language badge next to the title (inside `.job-card-list__title--link`, inline with LinkedIn's own "verified" icon). Language detection only runs once a job's full description arrives (see `jobDescriptions.ts`) — no title-based guessing; a job simply shows no badge and is never language-filtered until then. Button/badge injection is guarded by checking the live container for its own element, not a flag on the card — flags on the card would survive LinkedIn's content-recycling and skip re-injection.
- `src/content/filterBar.ts` — `findFilterBar()`, the shared "locate LinkedIn's top filter bar via an existing filter pill" lookup used by both `filterToggles.ts` and `languageFilter.ts`.
- `src/content/filterToggles.ts` — injects "Hide Applied"/"Hide Viewed" pills into LinkedIn's own top filter bar (Date Posted, Experience level, Easy Apply, ...), styled to match by reusing LinkedIn's own `artdeco-pill`/`search-reusables__filter-*` markup and classes.
- `src/content/language.ts` — wraps the `languagedetect` npm package (n-gram based, local/offline; same library [linkedin-language-filter](https://github.com/M1h4n1k/linkedin-language-filter) uses — switched to from `chrome.i18n.detectLanguage`, which gave worse results in practice) with an in-memory cache keyed by job id, detected once (from the description only, never the title — see `jobCard.ts`) and never re-run.
- `src/content/pageBridge.ts` — MAIN-world script (see manifest note above) that patches `window.fetch`/`XMLHttpRequest` to peek (via `.clone()`/a load listener, never altering what LinkedIn's own code receives) at two undocumented Voyager GraphQL endpoints carrying full job description text — one prefetches several postings' descriptions at once (URL contains `jobCardPrefetchQuery`; postings are `included` entries with `$type` `com.linkedin.voyager.dash.jobs.JobPosting`, description at `description.text`), the other loads a single posting's when its card is opened (URL contains `JOB_DESCRIPTION_CARD`; the posting is unconditionally `included[0]`, description at `descriptionText.text`). Both the endpoint fragments and this exact default-vs-prefetch shape/field distinction were taken from reading the source of [linkedin-language-filter](https://github.com/M1h4n1k/linkedin-language-filter) (Firefox-only — it reads response bodies via `browser.webRequest.filterResponseData`, which Chrome has no equivalent of; hence this MAIN-world-patching approach instead) — mirror that source, not a generalization of it, if this needs revisiting. XHR responses need a `responseType`-aware read (`.responseText` throws `InvalidStateError` for anything but `''`/`'text'`; LinkedIn uses `'blob'` for at least the single-job endpoint) — this was a real, previously-silent bug, not hypothetical. Writes the accumulated `{jobId: description}` set into a hidden `<script type="application/json" id="applyw-job-descriptions-buffer">` DOM element (a "data island" — inert, since browsers never execute a non-JS-typed script tag) and fires a payload-less `CustomEvent` as a "go re-read it" signal, rather than only ever sending data as the event's payload: this script runs at `document_start` and can see responses before the real (ISOLATED-world, `document_idle`) content script even exists to listen — e.g. LinkedIn auto-opens the first job's detail pane on page load, firing its description request immediately, and a `CustomEvent` fired with nothing listening yet is simply lost (this was a real bug: the first job's description consistently never made it through). DOM state doesn't have that problem — it's read whenever the other side gets around to it.
- `src/content/jobDescriptions.ts` — ISOLATED-world receiver; reads that buffer element (once on setup, to catch anything written before it started listening, and again on every signal event) rather than relying on the event's payload. `getJobDescription(jobId)` is what `jobCard.ts` checks before running detection.
- `src/content/languageFilter.ts` — injects a "Language" filter pill + dropdown (search box, checkbox list, Cancel/Apply) into the same filter bar, mirroring LinkedIn's own dropdown-style filters (e.g. Company). The dropdown panel is custom-styled, not a clone of `artdeco-hoverable-content` — that component's position is computed by LinkedIn's own JS, which we don't have.
- `src/popup/` — `index.html` + `main.tsx` (mount) + `Popup.tsx` (header: logo, "Beta" badge, version from `package.json`; lists blocked companies with an Unblock action; shows/clears the hidden-jobs count; footer links to the GitHub issues page) + `popup.css`. Brand colors (`--aw-navy`, `--aw-blue`) are approximated from `src/assets/applyw-logo.png` by eye, not pixel-sampled — nudge them if they drift from the real logo.
- `src/assets/applyw-logo.png` — the extension's logo, sourced from `resources/ApplyW_1254x1254.png`. Only wired into the popup so far; the extension has no toolbar/management-page icon yet (`manifest.config.ts` declares none) — worth adding once properly-sized icon files (16/32/48/128) exist.

Selectors here are copied from real LinkedIn markup, not guessed — if a selector stops matching (LinkedIn changed the DOM), ask for a fresh `outerHTML` sample of the affected card rather than guessing a replacement.

## Test suites

None yet — nothing here has automated tests.

## Code style

Keep comments brief; only comment where the logic isn't self-explanatory (e.g. why a debounce exists, why a specific attribute is used as the id).

## Configuration

No config/secrets file exists yet. If one is added, it must never be committed — wire it into `.gitignore` immediately.

## Commit conventions

Never commit on your own — the user commits once they're confident a feature is actually
complete/working, not after every change. Leave the working tree as-is and say what
changed; wait to be explicitly asked before running `git commit`. If you do get asked to
commit, commit directly on `main` — don't create a feature branch per change.

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
