import { blockCompany } from '../shared/storage'
import { normalizeCompanyName } from './jobCard'

// Real markup taken from a job's opened detail pane (the "top card"), not the compact
// search-result cards jobCard.ts handles — a separate DOM region, present only once at a
// time, that gets torn down and rebuilt whenever a different job is opened.
const COMPANY_NAME_SELECTOR = '.job-details-jobs-unified-top-card__company-name'
const BUTTON_CLASS = 'applyw-top-card-block-button'

function reportStorageError(action: string, error: unknown): void {
  console.error(`ApplyW: failed to ${action}`, error)
}

// Red reads as a destructive/blocking action at a glance — a deliberate, more prominent
// choice than the neutral Hide button, since blocking a whole company is the bigger,
// less-casual action of the two.
const RED = '#ef4444'
const RED_SOFT = 'rgba(239, 68, 68, 0.12)'

function createBanIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '12')
  svg.setAttribute('height', '12')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2.5')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.flex = '0 0 auto'

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  line.setAttribute('d', 'M4.929 4.929 19.071 19.071')
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', '12')
  circle.setAttribute('cy', '12')
  circle.setAttribute('r', '10')
  svg.append(line, circle)
  return svg
}

function styleButton(button: HTMLButtonElement): void {
  Object.assign(button.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: '12px',
    padding: '4px 12px',
    font: 'inherit',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: '20px',
    borderRadius: '16px',
    border: `1px solid ${RED}`,
    background: RED_SOFT,
    color: RED,
    verticalAlign: 'middle'
  })
  button.appendChild(createBanIcon())
  button.appendChild(document.createElement('span'))
}

function setBlockedState(button: HTMLButtonElement, isBlocked: boolean, companyName: string): void {
  const label = button.querySelector('span')
  if (label) label.textContent = isBlocked ? 'Blocked' : 'Block'
  button.disabled = isBlocked
  button.style.opacity = isBlocked ? '0.6' : '1'
  button.style.cursor = isBlocked ? 'default' : 'pointer'
  button.setAttribute('aria-label', isBlocked ? `${companyName} is blocked` : `Block ${companyName}`)
}

// Injects (or, on a later call, just re-syncs) a Block button next to the company name in
// the opened job's detail pane. Re-synced every call rather than injected once — like
// jobCard.ts's per-card buttons, "already injected" is checked against the live DOM, not a
// flag, since the pane gets rebuilt on every job switch. The click handler re-reads the
// company name from the DOM at click time (not a closured value from creation) so a button
// that happens to survive a job switch can never block the wrong, stale company.
export function syncTopCardBlockButton(blockedCompanies: Set<string>, onBlocked: () => void): void {
  const companyNameEl = document.querySelector(COMPANY_NAME_SELECTOR)
  const companyName = companyNameEl?.textContent?.trim()
  if (!companyNameEl || !companyName) return

  let button = companyNameEl.parentElement?.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`) ?? null
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = BUTTON_CLASS
    styleButton(button)
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const currentName = document.querySelector(COMPANY_NAME_SELECTOR)?.textContent?.trim()
      if (!currentName) return
      void blockCompany(normalizeCompanyName(currentName))
        .then(onBlocked)
        .catch((error) => reportStorageError(`block company ${currentName}`, error))
    })
    companyNameEl.insertAdjacentElement('afterend', button)
  }

  setBlockedState(button, blockedCompanies.has(normalizeCompanyName(companyName)), companyName)
}
