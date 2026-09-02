import { blockCompany, hideJob, type Settings } from '../shared/storage'
import { ensureLanguageDetected, getCachedLanguage } from './language'
import { getJobDescription } from './jobDescriptions'

export const JOB_CARD_SELECTOR = 'li[data-occludable-job-id]'

const ACTION_BUTTON_CLASS = 'applyw-action-button'
const COMPANY_NAME_SELECTOR = '.artdeco-entity-lockup__subtitle'
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

// Injects Hide + Block-company buttons next to LinkedIn's own Dismiss button.
// LinkedIn virtualizes this list: a card's inner content (including the actions
// container) can be torn down and rebuilt as it scrolls in/out of view, so "already
// processed" is checked against the live container's own children rather than a flag
// on the outer <li> — a flag there would survive the rebuild and skip re-injecting.
export function injectActionButtons(card: HTMLElement): void {
  const jobId = getJobId(card)
  const actionsContainer = card.querySelector('.job-card-list__actions-container')
  if (!jobId || !actionsContainer) return
  if (actionsContainer.querySelector(`.${ACTION_BUTTON_CLASS}`)) return

  actionsContainer.appendChild(
    createActionButton('Hide', 'Hide this job', () => {
      void hideJob(jobId)
        .then(() => hideCard(card))
        .catch((error) => reportStorageError('hide job', error))
    })
  )

  const companyName = getCompanyName(card)
  if (companyName) {
    actionsContainer.appendChild(
      createActionButton('Block', `Block ${companyName}`, () => {
        void blockCompany(normalizeCompanyName(companyName))
          .then(() => hideCard(card))
          .catch((error) => reportStorageError(`block company ${companyName}`, error))
      })
    )
  }
}

export function applyHiddenState(
  card: HTMLElement,
  hiddenJobIds: Set<string>,
  blockedCompanies: Set<string>,
  settings: Settings,
  selectedLanguages: Set<string>
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

  // Set unconditionally (not just hide) so a recycled card correctly ends up visible
  // when reused for a job that isn't hidden/blocked.
  card.style.display =
    isHiddenJob || isBlockedCompany || isHiddenApplied || isHiddenViewed || isHiddenByLanguage ? 'none' : ''
}
