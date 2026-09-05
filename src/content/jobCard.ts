import { hideJob, type HiddenJob, type Settings } from '../shared/storage'
import { noteHide } from '../shared/metrics'
import { ensureLanguageDetected, getCachedLanguage } from './language'
import { getJobDescription } from './jobDescriptions'

export const JOB_CARD_SELECTOR = 'li[data-occludable-job-id]'

const ACTION_BUTTON_CLASS = 'applyw-action-button'
// LinkedIn's own per-card "X" dismiss button — aria-label is "Dismiss <job title> job", so
// matched by prefix rather than the full label.
const NATIVE_DISMISS_BUTTON_SELECTOR = 'button[aria-label^="Dismiss "]'
const COMPANY_NAME_SELECTOR = '.artdeco-entity-lockup__subtitle'
// LinkedIn already combines location and workplace type into one string per <li> here
// (e.g. "Netherlands (Remote)") — joined rather than just reading the first, in case a
// card ever renders a second item (e.g. salary) in the same wrapper.
const LOCATION_ITEM_SELECTOR = '.job-card-container__metadata-wrapper li'
const FOOTER_ITEM_SELECTOR = '.job-card-container__footer-item'
const LANGUAGE_BADGE_CLASS = 'applyw-language-badge'
// Where the language badge gets inserted — see renderLanguageBadge.
const TITLE_LINK_SELECTOR = '.job-card-list__title--link'

export function getJobId(card: Element): string | null {
  return card.getAttribute('data-occludable-job-id')
}

export function getCompanyName(card: Element): string | null {
  const text = card.querySelector(COMPANY_NAME_SELECTOR)?.textContent
  return text ? text.trim() : null
}

export function getJobLocation(card: Element): string {
  return Array.from(card.querySelectorAll(LOCATION_ITEM_SELECTOR))
    .map((item) => item.textContent?.trim())
    .filter((text): text is string => Boolean(text))
    .join(' · ')
}

// The title link's own href carries a long tracking query string (eBP=..., trk=...) that
// isn't meant to be stored/reused — LinkedIn's permalink format is just the job id, seen in
// that same href's path (/jobs/view/<id>/...), so build a clean link from the id instead.
function getJobUrl(jobId: string): string {
  return `https://www.linkedin.com/jobs/view/${jobId}/`
}

// Shows the detected language right next to the job title, inline with LinkedIn's own
// "verified" icon — reads as part of the title rather than a separate row. Looked up (not
// a stale flag) each call so a recycled title link's badge gets updated/cleared for
// whatever job it's currently showing.
function renderLanguageBadge(card: HTMLElement, languageCode: string | null): void {
  const titleLink = card.querySelector(TITLE_LINK_SELECTOR)
  if (!titleLink) return

  let badge = titleLink.querySelector<HTMLElement>(`.${LANGUAGE_BADGE_CLASS}`)
  if (!languageCode) {
    badge?.remove()
    return
  }

  if (!badge) {
    badge = document.createElement('span')
    badge.className = LANGUAGE_BADGE_CLASS
    Object.assign(badge.style, {
      display: 'inline-block',
      marginLeft: '6px',
      padding: '1px 6px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      borderRadius: '10px',
      border: '1px solid rgba(128, 128, 128, 0.5)',
      opacity: '0.75',
      verticalAlign: 'middle'
    })
    titleLink.appendChild(badge)
  }
  if (badge.textContent !== languageCode) badge.textContent = languageCode
}

// The language badge (see renderLanguageBadge) lives *inside* the title link as a child
// element, so a plain textContent read would pick up its 2-letter code too — cloned and
// stripped out here so keyword matching only ever sees the actual title text.
export function getJobTitle(card: Element): string | null {
  const titleLink = card.querySelector(TITLE_LINK_SELECTOR)
  if (!titleLink) return null
  const clone = titleLink.cloneNode(true) as Element
  clone.querySelector(`.${LANGUAGE_BADGE_CLASS}`)?.remove()
  const text = clone.textContent
  return text ? text.trim() : null
}

// Companies are matched case-insensitively so "R+V Versicherung" and a differently-cased
// mention of the same company are treated as one block entry.
export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase()
}

function hideCard(card: HTMLElement): void {
  card.style.display = 'none'
}

// LinkedIn shows badges like "Viewed" and "Applied" as short text in the card footer.
// Matched by text (only "Viewed" has been seen in real markup so far) rather than a
// state-specific class, and `startsWith` covers a possible "Applied 2d ago" variant.
function hasFooterState(card: Element, label: string): boolean {
  const items = card.querySelectorAll(FOOTER_ITEM_SELECTOR)
  return Array.from(items).some((item) => {
    const text = item.textContent?.trim()
    return text === label || text?.startsWith(`${label} `)
  })
}

function reportStorageError(action: string, error: unknown): void {
  console.error(`ApplyW: failed to ${action}`, error)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Whole-word match (case-insensitive) so "Java" doesn't match inside "JavaScript" — not a
// stemmed/partial match, so "Junior" also won't match "Juniors".
function containsAnyWord(lowerText: string, words: Set<string>): boolean {
  return Array.from(words).some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`).test(lowerText))
}

// Which words matched, not just whether any did — the per-word tallies in metrics.ts need
// to know which one caught the job.
function matchingWords(lowerText: string, words: Set<string>): string[] {
  return Array.from(words).filter((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`).test(lowerText))
}

// Matches against the title (always known immediately) and the description (arrives
// later, if at all — see jobDescriptions.ts) — a word in either counts. Same "only hide on
// a positive, known mismatch" rule as language filtering below applies per-criterion:
// - must-exclude can hide as soon as the title alone matches; a word only in a
//   not-yet-arrived description can't cause a false hide.
// - must-include can only fail once the description has arrived (or never comes) — a title
//   that doesn't match yet might still be satisfied by the description.
interface KeywordVerdict {
  hidden: boolean
  // Which of the two rules fired, so metrics.ts can attribute the hide.
  reason?: 'excludedWord' | 'missingWord'
  // Every excluded word that matched — a job can be caught by several at once.
  matchedWords: string[]
}

function evaluateKeywords(
  card: Element,
  jobId: string | null,
  mustIncludeWords: Set<string>,
  mustExcludeWords: Set<string>
): KeywordVerdict {
  if (mustIncludeWords.size === 0 && mustExcludeWords.size === 0) return { hidden: false, matchedWords: [] }

  const title = getJobTitle(card)
  const description = jobId ? getJobDescription(jobId) : undefined
  const lowerTitle = title ? title.toLowerCase() : ''
  const lowerDescription = description?.toLowerCase()

  // Checked first, matching the precedence metrics.ts attributes by.
  const excluded = new Set<string>(matchingWords(lowerTitle, mustExcludeWords))
  if (lowerDescription !== undefined) {
    for (const word of matchingWords(lowerDescription, mustExcludeWords)) excluded.add(word)
  }
  if (excluded.size > 0) return { hidden: true, reason: 'excludedWord', matchedWords: Array.from(excluded) }

  const matchesInclude =
    containsAnyWord(lowerTitle, mustIncludeWords) ||
    (lowerDescription !== undefined && containsAnyWord(lowerDescription, mustIncludeWords))
  if (mustIncludeWords.size > 0 && !matchesInclude && lowerDescription !== undefined) {
    return { hidden: true, reason: 'missingWord', matchedWords: [] }
  }

  return { hidden: false, matchedWords: [] }
}

function createActionButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.className = ACTION_BUTTON_CLASS
  button.setAttribute('aria-label', ariaLabel)
  // Plain styling instead of LinkedIn's artdeco-button classes, which assume an
  // icon-sized box and wrap short text like "Hide"/"Block" onto multiple lines.
  Object.assign(button.style, {
    whiteSpace: 'nowrap',
    padding: '4px 12px',
    marginLeft: '4px',
    fontSize: '14px',
    lineHeight: '20px',
    borderRadius: '16px',
    border: '1px solid rgba(0, 0, 0, 0.6)',
    background: 'transparent',
    cursor: 'pointer'
  })
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

// Injects a Hide button in place of LinkedIn's own Dismiss ("X") button, which is hidden —
// it's a separate, LinkedIn-side hide mechanism that duplicates ours without going through
// our own storage, so keeping both visible would just be two different "hide" buttons that
// do different things. Block lives only on the opened job's detail pane (see
// topCardBlockButton.ts) — blocking a company is a bigger, less-undoable action than hiding
// one job, so it's reserved for the view where you've actually looked at the company, not a
// one-click option on every compact list row.
// LinkedIn virtualizes this list: a card's inner content (including the actions
// container) can be torn down and rebuilt as it scrolls in/out of view, so "already
// processed" is checked against the live container's own children rather than a flag
// on the outer <li> — a flag there would survive the rebuild and skip re-injecting.
export function injectActionButtons(card: HTMLElement): void {
  const jobId = getJobId(card)
  const actionsContainer = card.querySelector('.job-card-list__actions-container')
  if (!jobId || !actionsContainer) return

  // Checked unconditionally (not just on first injection) since LinkedIn's recycling could
  // in principle restore it independently of our own buttons.
  const dismissButton = actionsContainer.querySelector<HTMLElement>(NATIVE_DISMISS_BUTTON_SELECTOR)
  if (dismissButton) dismissButton.style.display = 'none'

  if (actionsContainer.querySelector(`.${ACTION_BUTTON_CLASS}`)) return

  actionsContainer.appendChild(
    createActionButton('Hide', 'Hide this job', () => {
      // Snapshotted now, not re-read later — LinkedIn recycles this card's content once
      // it's hidden and scrolled away, so this is the only moment this data is available.
      const job: HiddenJob = {
        jobId,
        title: getJobTitle(card) ?? 'Job',
        url: getJobUrl(jobId),
        company: getCompanyName(card) ?? '',
        location: getJobLocation(card),
        hiddenAt: Date.now()
      }
      void hideJob(job)
        .then(() => hideCard(card))
        .catch((error) => reportStorageError('hide job', error))
    })
  )
}

export function applyHiddenState(
  card: HTMLElement,
  hiddenJobIds: Set<string>,
  blockedCompanies: Set<string>,
  settings: Settings,
  selectedLanguages: Set<string>,
  mustIncludeWords: Set<string>,
  mustExcludeWords: Set<string>
): void {
  const jobId = getJobId(card)
  const companyName = getCompanyName(card)
  const isHiddenJob = jobId !== null && hiddenJobIds.has(jobId)
  const isBlockedCompany = companyName !== null && blockedCompanies.has(normalizeCompanyName(companyName))
  const isHiddenApplied = settings.hideApplied && hasFooterState(card, 'Applied')
  const isHiddenViewed = settings.hideViewed && hasFooterState(card, 'Viewed')

  // Detection (and the badge showing its result) only ever runs once pageBridge.ts hands
  // over the job's full description (see jobDescriptions.ts) — a title is too short/
  // unreliable to detect from, so a job simply shows no badge and is never language-
  // filtered until its description actually arrives (from LinkedIn prefetching it, or the
  // card being opened).
  let detectedLanguage: string | null = null
  if (jobId) {
    const description = getJobDescription(jobId)
    detectedLanguage = description ? ensureLanguageDetected(jobId, description) : (getCachedLanguage(jobId) ?? null)
  }
  renderLanguageBadge(card, detectedLanguage)

  // Only hide on a positive, known mismatch — a job whose language hasn't resolved yet
  // (or couldn't be detected) stays visible rather than being hidden on missing data.
  const isHiddenByLanguage =
    selectedLanguages.size > 0 && detectedLanguage !== null && !selectedLanguages.has(detectedLanguage)
  const keywords = evaluateKeywords(card, jobId, mustIncludeWords, mustExcludeWords)

  const isHidden =
    isHiddenJob || isBlockedCompany || isHiddenApplied || isHiddenViewed || isHiddenByLanguage || keywords.hidden

  // Set unconditionally (not just hide) so a recycled card correctly ends up visible
  // when reused for a job that isn't hidden/blocked.
  card.style.display = isHidden ? 'none' : ''

  // Exactly one reason per job, most deliberate first — see PRIMARY_REASON_ORDER in
  // metrics.ts. noteHide() ignores a job it has already counted, so calling it on every
  // rescan is safe.
  if (isHidden && jobId) {
    if (isHiddenJob) noteHide(jobId, 'manual')
    else if (isBlockedCompany) noteHide(jobId, 'company')
    else if (keywords.reason === 'excludedWord') noteHide(jobId, 'excludedWord', keywords.matchedWords)
    else if (keywords.reason === 'missingWord') noteHide(jobId, 'missingWord')
    else if (isHiddenByLanguage) noteHide(jobId, 'language')
    else if (isHiddenApplied) noteHide(jobId, 'applied')
    else if (isHiddenViewed) noteHide(jobId, 'viewed')
  }
}
