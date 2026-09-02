import { blockCompany, hideJob } from './storage'

export const JOB_CARD_SELECTOR = 'li[data-occludable-job-id]'

const PROCESSED_ATTR = 'data-applyw-processed'
const COMPANY_NAME_SELECTOR = '.artdeco-entity-lockup__subtitle'

export function getJobId(card: Element): string | null {
  return card.getAttribute('data-occludable-job-id')
}

export function getCompanyName(card: Element): string | null {
  const text = card.querySelector(COMPANY_NAME_SELECTOR)?.textContent
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

function createActionButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.className = 'applyw-action-button'
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

// Injects Hide + Block-company buttons next to LinkedIn's own Dismiss button, once per card.
export function injectActionButtons(card: HTMLElement): void {
  if (card.hasAttribute(PROCESSED_ATTR)) return

  const jobId = getJobId(card)
  const actionsContainer = card.querySelector('.job-card-list__actions-container')
  if (!jobId || !actionsContainer) return

  actionsContainer.appendChild(
    createActionButton('Hide', 'Hide this job', () => {
      void hideJob(jobId).then(() => hideCard(card))
    })
  )

  const companyName = getCompanyName(card)
  if (companyName) {
    actionsContainer.appendChild(
      createActionButton('Block', `Block ${companyName}`, () => {
        void blockCompany(normalizeCompanyName(companyName)).then(() => hideCard(card))
      })
    )
  }

  card.setAttribute(PROCESSED_ATTR, 'true')
}

export function applyHiddenState(
  card: HTMLElement,
  hiddenJobIds: Set<string>,
  blockedCompanies: Set<string>
): void {
  const jobId = getJobId(card)
  const companyName = getCompanyName(card)
  const isHiddenJob = jobId !== null && hiddenJobIds.has(jobId)
  const isBlockedCompany = companyName !== null && blockedCompanies.has(normalizeCompanyName(companyName))
  if (isHiddenJob || isBlockedCompany) hideCard(card)
}
