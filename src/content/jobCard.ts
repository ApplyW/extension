import { blockCompany, hideJob, type Settings } from '../shared/storage'
import { ensureLanguageDetected, getCachedLanguage } from './language'

export const JOB_CARD_SELECTOR = 'li[data-occludable-job-id]'

const ACTION_BUTTON_CLASS = 'applyw-action-button'
const COMPANY_NAME_SELECTOR = '.artdeco-entity-lockup__subtitle'
const FOOTER_ITEM_SELECTOR = '.job-card-container__footer-item'
const TITLE_SELECTOR = '.job-card-list__title--link'

export function getJobId(card: Element): string | null {
  return card.getAttribute('data-occludable-job-id')
}

export function getCompanyName(card: Element): string | null {
  const text = card.querySelector(COMPANY_NAME_SELECTOR)?.textContent
  return text ? text.trim() : null
}

// The search-results card only ever renders the title (no description text), so language
// detection runs on this alone. Titles are short, which chrome.i18n.detectLanguage is
// less reliable on than a full paragraph — treat its guess as a heuristic, not a fact.
export function getJobTitle(card: Element): string | null {
  const text = card.querySelector(TITLE_SELECTOR)?.textContent
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
  selectedLanguages: Set<string>,
  onLanguageDetected: () => void
): void {
  const jobId = getJobId(card)
  const companyName = getCompanyName(card)
  const isHiddenJob = jobId !== null && hiddenJobIds.has(jobId)
  const isBlockedCompany = companyName !== null && blockedCompanies.has(normalizeCompanyName(companyName))
  const isHiddenApplied = settings.hideApplied && hasFooterState(card, 'Applied')
  const isHiddenViewed = settings.hideViewed && hasFooterState(card, 'Viewed')

  // Only hide on a positive, known mismatch — a job whose language hasn't resolved yet
  // (or couldn't be detected) stays visible rather than being hidden on missing data.
  let isHiddenByLanguage = false
  if (jobId && selectedLanguages.size > 0) {
    const title = getJobTitle(card)
    if (title) ensureLanguageDetected(jobId, title, onLanguageDetected)
    const detectedLanguage = getCachedLanguage(jobId)
    isHiddenByLanguage = detectedLanguage != null && !selectedLanguages.has(detectedLanguage)
  }

  // Set unconditionally (not just hide) so a recycled card correctly ends up visible
  // when reused for a job that isn't hidden/blocked.
  card.style.display =
    isHiddenJob || isBlockedCompany || isHiddenApplied || isHiddenViewed || isHiddenByLanguage ? 'none' : ''
}
