# CLAUDE.md

Guidance for Claude when working in this codebase.

"ApplyW" is a play on "Apply Wisely" — worth keeping in mind for any
marketing copy (README, store listing, popup): the name should read as
that pun, not as an unexplained abbreviation.

## Stack

- **Language**: TypeScript
- **Build**: Vite + `@crxjs/vite-plugin` (CRXJS)
- **Platform**: Chrome Extension, Manifest V3
- **Scope today**: content script (`https://www.linkedin.com/jobs/search/*` — not all of `/jobs/*`; other job paths like `/jobs/search-job/` use a different DOM this code doesn't handle) + a React popup — no background service worker yet
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
- `src/shared/storage.ts` — `chrome.storage.local` read/write, shared by the content script and the popup. Company names are stored normalized (trimmed, lowercased) for matching, so the popup currently displays them lowercased too — known rough edge, not fixed. Also holds `Settings` (`hideApplied`/`hideViewed`), one JSON object under a single key rather than the get/add/remove-set pattern used for hidden jobs/blocked companies. Keyword-filter word lists (`mustIncludeWords`/`mustExcludeWords`) follow the same whole-selection-replaced-via-Apply pattern as `selectedLanguages`, not the add/remove-one-at-a-time pattern. Hidden jobs are stored as full `HiddenJob` records (title/url/company/location/`hiddenAt`), not bare ids — snapshotted once at hide time in `jobCard.ts` since LinkedIn recycles the card's content once it scrolls away, so that's the only moment the data exists; `getHiddenJobIds()` derives the `Set<string>` the content script's hide-check actually needs from that. A pre-0.1.4 entry (bare id string, no snapshot) is normalized into a placeholder record on read (title `"Job"`, empty company/location, `hiddenAt` 0) rather than dropped, so upgrading users don't get old hidden jobs silently unhidden.
- `src/shared/metrics.ts` — counts of how many listings each filter hid, so the metrics page can rank them. Two rules keep the numbers honest and both are easy to break: a job is counted **once, ever** (`applyHiddenState` runs on every rescan for every card and LinkedIn recycles cards constantly — without the seen-id set a single job would be counted hundreds of times as you scroll), and each job is attributed to **exactly one** reason by `PRIMARY_REASON_ORDER`, so the parts sum to the whole. The per-word tallies are a separate question ("how many jobs did this word catch?") and deliberately do *not* partition the total, since one job can match several excluded words — the website labels that explicitly. Writes are buffered and flushed once a second; the seen-id list is capped at 5000 to bound the storage key, so a job resurfacing after that could be counted twice.
- `src/shared/site.ts` — the website's address, in one place. `manifest.config.ts` builds `externally_connectable` from it and the popup's metrics link points at it; if those two ever disagree the link opens a page the extension then refuses to answer, which is indistinguishable from the feature being broken. Moving to a custom domain means editing this file and keeping *both* origins listed until the new version clears store review — days during which anyone on the new domain would otherwise be told to install what they already have. The site now lives at `applyw.app`; the old `workers.dev` origin is still listed, and still served, only because the previously published extension can talk to nothing else. Remove it — from here, from Cloudflare, and from the store listing — once the release carrying `applyw.app` has rolled out, since an origin left in this list stays permitted to read the user's counts.
- `src/background.ts` — the extension's only background worker, and it exists for exactly one reason: `chrome.runtime.onMessageExternal` is delivered to a service worker and nowhere else — not a content script, not the popup. It answers `applyw:getMetrics` from the website. The manifest's `externally_connectable` is the *only* gate on who may ask; don't reintroduce a second allowlist here, because the day this moves to a custom domain one of the two copies gets forgotten and metrics silently dies. In dev builds `manifest.config.ts` also allows `http://localhost:5173`, gated on `mode === 'development'` so a published extension never answers anything on localhost.
- `src/content/index.ts` — entry point: initial scan of job cards, a `MutationObserver` (debounced) that rescans on any DOM change (LinkedIn virtualizes/recycles cards, so this can't be limited to "new card appeared"), and a `chrome.storage.onChanged` listener so popup edits (e.g. unblocking a company) take effect without a page reload. Reloading/updating the extension severs an already-open tab's connection to `chrome.*` APIs ("Extension context invalidated" in the console) — `scanForCards()` checks `chrome.runtime?.id` (reads `undefined` once invalidated, no exception needed) before every rescan and stops the observer for good on the first failure, rather than retrying (and failing) on every subsequent DOM change for the rest of the tab's life. The fix for a stale tab is always just refreshing the page.
- `src/content/jobCard.ts` — DOM layer: reads a card's `data-occludable-job-id`, company name (`.artdeco-entity-lockup__subtitle`), location/workplace type (`.job-card-container__metadata-wrapper li` — LinkedIn already combines them into one string per item, e.g. "Netherlands (Remote)"), and footer state badges (`.job-card-container__footer-item`, e.g. "Viewed"/"Applied") matched by text since only "Viewed" has been seen in real markup; injects a Hide button into LinkedIn's own `.job-card-list__actions-container` in place of LinkedIn's own Dismiss ("X") button, which is hidden (`button[aria-label^="Dismiss "]`) since it's a separate, LinkedIn-side hide mechanism that would otherwise duplicate ours (Block lives only on the detail pane — see `topCardBlockButton.ts`), applies hidden state, and renders the detected-language badge next to the title (inside `.job-card-list__title--link`, inline with LinkedIn's own "verified" icon). Language detection only runs once a job's full description arrives (see `jobDescriptions.ts`) — no title-based guessing; a job simply shows no badge and is never language-filtered until then. Keyword filtering (`evaluateKeywords`, which reports *which* rule fired and which excluded words matched, so `metrics.ts` can attribute the hide) matches the must-include/must-exclude word sets against the title (`getJobTitle`, which strips the language badge element out of the title link's text first) and the description, either counts, whole-word and case-insensitive (so "Java" doesn't match inside "JavaScript"). Per-criterion "known mismatch" rule: must-exclude can hide on a title-only match (no need to wait for the description); must-include can only fail once the description has arrived (or never comes) — a non-matching title alone isn't conclusive. Button/badge injection is guarded by checking the live container for its own element, not a flag on the card — flags on the card would survive LinkedIn's content-recycling and skip re-injection.
- `src/content/filterBar.ts` — `findFilterBar()`, the shared "locate LinkedIn's top filter bar via an existing filter pill" lookup used by `filterToggles.ts`, `languageFilter.ts`, and `keywordFilter.ts`.
- `src/content/filterToggles.ts` — injects "Hide Applied"/"Hide Viewed" pills into LinkedIn's own top filter bar (Date Posted, Experience level, Easy Apply, ...), styled to match by reusing LinkedIn's own `artdeco-pill`/`search-reusables__filter-*` markup and classes.
- `src/content/language.ts` — wraps the `languagedetect` npm package (n-gram based, local/offline; same library [linkedin-language-filter](https://github.com/M1h4n1k/linkedin-language-filter) uses — switched to from `chrome.i18n.detectLanguage`, which gave worse results in practice) with an in-memory cache keyed by job id, detected once (from the description only, never the title — see `jobCard.ts`) and never re-run.
- `src/content/pageBridge.ts` — MAIN-world script (see manifest note above) that patches `window.fetch`/`XMLHttpRequest` to peek (via `.clone()`/a load listener, never altering what LinkedIn's own code receives) at two undocumented Voyager GraphQL endpoints carrying full job description text — one prefetches several postings' descriptions at once (URL contains `jobCardPrefetchQuery`; postings are `included` entries with `$type` `com.linkedin.voyager.dash.jobs.JobPosting`, description at `description.text`), the other loads a single posting's when its card is opened (URL contains `JOB_DESCRIPTION_CARD`; the posting is unconditionally `included[0]`, description at `descriptionText.text`). Both the endpoint fragments and this exact default-vs-prefetch shape/field distinction were taken from reading the source of [linkedin-language-filter](https://github.com/M1h4n1k/linkedin-language-filter) (Firefox-only — it reads response bodies via `browser.webRequest.filterResponseData`, which Chrome has no equivalent of; hence this MAIN-world-patching approach instead) — mirror that source, not a generalization of it, if this needs revisiting. XHR responses need a `responseType`-aware read (`.responseText` throws `InvalidStateError` for anything but `''`/`'text'`; LinkedIn uses `'blob'` for at least the single-job endpoint) — this was a real, previously-silent bug, not hypothetical. Writes the accumulated `{jobId: description}` set into a hidden `<script type="application/json" id="applyw-job-descriptions-buffer">` DOM element (a "data island" — inert, since browsers never execute a non-JS-typed script tag) and fires a payload-less `CustomEvent` as a "go re-read it" signal, rather than only ever sending data as the event's payload: this script runs at `document_start` and can see responses before the real (ISOLATED-world, `document_idle`) content script even exists to listen — e.g. LinkedIn auto-opens the first job's detail pane on page load, firing its description request immediately, and a `CustomEvent` fired with nothing listening yet is simply lost (this was a real bug: the first job's description consistently never made it through). DOM state doesn't have that problem — it's read whenever the other side gets around to it.
- `src/content/jobDescriptions.ts` — ISOLATED-world receiver; reads that buffer element (once on setup, to catch anything written before it started listening, and again on every signal event) rather than relying on the event's payload. `getJobDescription(jobId)` is what `jobCard.ts` checks before running detection.
- `src/content/languageFilter.ts` — injects a "Language" filter pill + dropdown (search box, checkbox list, Cancel/Apply) into the same filter bar, mirroring LinkedIn's own dropdown-style filters (e.g. Company). The dropdown panel is custom-styled, not a clone of `artdeco-hoverable-content` — that component's position is computed by LinkedIn's own JS, which we don't have.
- `src/content/topCardBlockButton.ts` — injects a red, icon-labeled Block button next to the company name in the opened job's detail pane (`.job-details-jobs-unified-top-card__company-name`), a separate DOM region from the search-result cards `jobCard.ts` handles. This is the *only* place Block lives — `jobCard.ts`'s per-card actions only offer Hide; blocking a whole company is reserved for the view where you've actually looked at it, not a one-click option on every compact list row. Re-synced on every rescan rather than injected once, since the pane is rebuilt whenever a different job is opened; the click handler re-reads the company name from the DOM at click time (never a value captured at button-creation time), so a button that happens to survive a job switch can never block the wrong, stale company.
- `src/content/keywordFilter.ts` — injects a "Keywords" filter pill + dropdown with two staged word lists, "Must include" and "Must exclude", each a type-and-press-Enter chip input matched against a job's title and description (see `isHiddenByKeywords` in `jobCard.ts`). Same trigger/panel/staged-until-Apply structure as `languageFilter.ts`. Words are normalized (trimmed, lowercased) for storage/matching — same known rough edge as blocked company display (see `storage.ts`).
- `src/popup/` — `index.html` + `main.tsx` (mount) + `Popup.tsx` + `popup.css`. Three screens behind one `view` state (`main` | `companies` | `hidden`), all inside the one action popup — no second `chrome.windows.create` window, and deliberately *both* lists as drill-downs rather than one inline and one drilled-in, so the two halves behave the same way. `main` is header (logo, "Beta", version from `package.json`) + hero + two nav rows; the hero leads with the action — "Open LinkedIn Jobs" in a new tab via `chrome.tabs.create`, or an "ApplyW is filtering this tab" line if the active tab (checked once via `chrome.tabs.query`) is already there — with the running tally underneath, since people open this popup to *do* something, not to read a dashboard. The tab check needs no `tabs` permission — `content_scripts.matches` already implies host permission for that URL, which is what lets `chrome.tabs.query()` populate `url` on the matching tab at all. `companies` lists blocked companies with Unblock, plus a filter box once there are more than `COMPANY_SEARCH_THRESHOLD` (5) — below that it's more clutter than help. `hidden` lists hidden jobs latest-first: linked title, bold company + location, relative "Hidden X ago" (`Intl.RelativeTimeFormat`; `hiddenAt` 0 renders "a while ago" for pre-0.1.4 entries), each line ellipsis-truncated to stay one row tall, with Unhide vertically centred so row-to-row spacing doesn't shift with text length. Verbs stay consistent across the flow — the card button says Hide, so the popup says Unhide (not "Undo", which wrongly implies reverting the *last* action) and the bulk action is "Unhide all", armed on a first press that restates the count since bulk unhiding can't be walked back one job at a time. Empty lists show instructional copy rather than bouncing back to `main`. The metrics page is reached by an icon-only link sitting on the tally line, not by a third nav row: the nav rows' chevrons promise a drill-down inside the popup and this opens a tab, and the tally is the same subject one level up ("how much was cleared" → "which filter did it"). It's hidden until the tally is non-empty, so it can never open a page with nothing on it.
- **Popup design system** (`popup.css`) — derived from the AW monogram, and meant to be portable to the website. Every stroke in the mark ends in a diagonal shear, so a small skewed tick (`.tick`, `skewX(-18deg)`) is the one repeated motif, and it encodes rather than decorates: navy (`--aw-mark`) marks a blocked company (structural, permanent), electric blue (`--aw-signal`) marks a hidden job (light, reversible) — the pairing is taught by the two nav rows on `main`, then reused as the row marker on each list. Don't add a tick anywhere it doesn't mean "a thing removed". The mark has no curves, so radius is 2px, not pills; icons follow the same rule — straight segments, flat (`butt`) stroke ends, no rounded caps, which is why the footer's bug is hand-drawn rather than a stock glyph. The metrics icon takes that further: it's three ticks at three heights on a shared baseline, so the "a thing removed" motif composes into "counts of things removed" rather than borrowing a stock bar-chart glyph — drawn as parallelograms rather than rects under a skew transform, so the lean is exactly `--aw-shear` and nothing escapes the viewBox. The same cut appears once more as `--aw-cut`, a slanted right edge on whatever fills the hero slot — cut across the full edge, the way the monogram terminates a stroke, *not* as a corner chamfer, which was tried first and read as accidental damage — the primary button and the "filtering this tab" status share it so the slot keeps one silhouette either way, with solid fill reading as an action and soft fill as passive state. `clip-path` clips the focus outline away with the corner, so `.button-primary` draws its focus ring with an inset shadow instead — keep that if you touch the cut. Colors are role-named tokens (`--aw-mark`/`--aw-signal`/`--aw-text`/`--aw-mute`/`--aw-rule`/`--aw-surface`/`--aw-recess`) so dark mode flips coherently; they're eyeballed from `src/assets/applyw-logo.png`, not pixel-sampled — nudge them if they drift. No all-caps labels (the previous uppercase `h2`s and "BETA" chip were the clearest generated-UI tell in the old popup), no arrows appended to button/link text, hierarchy carried by weight and color instead. Fonts stay a **system stack on purpose**: a webfont would mean a request to `fonts.gstatic.com` on every popup open, contradicting the "nothing leaves your browser" promise the extension is sold on — bundle a font file locally if that ever needs to change. Motion is one moment only (the 130ms screen transition), and `prefers-reduced-motion` disables it.
- `src/assets/applyw-logo.png` — the extension's logo, sourced from `resources/ApplyW_1254x1254.png`. Used in the popup header.
- `src/assets/icons/` — `icon16/32/48/128.png`, downscaled from the logo via .NET's `System.Drawing` (no Node image-resizing tool was available; regenerate the same way — `Add-Type -AssemblyName System.Drawing`, `HighQualityBicubic` interpolation — if the source logo ever changes). Wired into `manifest.config.ts`'s `icons` and `action.default_icon` — required for the Chrome Web Store listing, not just cosmetic.

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

Body: a short bullet list of what changed, written for a non-technical reader — what the
feature/fix does, not how it's implemented. No prose paragraphs, no internal rationale, no
mention of specific functions/selectors/permissions/etc. — that detail belongs in code
comments or CLAUDE.md, not the commit body.

Footer: breaking change details, ticket/issue links, then the attribution trailer (see below).

Example:
```
feat(content-script): block companies, hiding their cards on sight

- Block button on each job card
- Blocked companies persisted in chrome.storage.local
- Cards from blocked companies hidden automatically

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_<id>
```
