import { hideJob } from './storage'

export const JOB_CARD_SELECTOR = 'li[data-occludable-job-id]'

const PROCESSED_ATTR = 'data-applyw-processed'

export function getJobId(card: Element): string | null {
  return card.getAttribute('data-occludable-job-id')
}

function hideCard(card: HTMLElement): void {
  card.style.display = 'none'
}

function createHideButton(jobId: string, card: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Hide'
  button.className = 'applyw-hide-button'
  button.setAttribute('aria-label', 'Hide this job')
  // Plain styling instead of LinkedIn's artdeco-button classes, which assume
  // an icon-sized box and wrap text like "Hide" onto multiple lines.
  Object.assign(button.style, {
    whiteSpace: 'nowrap',
    padding: '4px 12px',
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
    void hideJob(jobId).then(() => hideCard(card))
  })
  return button
}

// Injects a Hide button next to LinkedIn's own Dismiss button, once per card.
export function injectHideButton(card: HTMLElement): void {
  if (card.hasAttribute(PROCESSED_ATTR)) return

  const jobId = getJobId(card)
  const actionsContainer = card.querySelector('.job-card-list__actions-container')
  if (!jobId || !actionsContainer) return

  actionsContainer.appendChild(createHideButton(jobId, card))
  card.setAttribute(PROCESSED_ATTR, 'true')
}

export function applyHiddenState(card: HTMLElement, hiddenJobIds: Set<string>): void {
  const jobId = getJobId(card)
  if (jobId && hiddenJobIds.has(jobId)) hideCard(card)
}
