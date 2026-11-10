import { findAllFilterBars, findPillInsertionPoint, hasRenderedChips, isNewStyleFilterBar } from './filterBar'
import { createChevronIcon, styleNewStylePill } from './newStylePill'

export interface DropdownFilterConfig<S> {
  // Marks the trigger; also how an already-injected bar is recognised (see syncDropdownFilter).
  markerClass: string
  // Only set on the legacy page, which renders the bar once; the new-style bar can render
  // twice and a duplicated id would be invalid.
  legacyId: string
  ariaLabel: string
  label: (state: S) => { text: string; isActive: boolean }
  createPanel: (state: S, onApply: (next: S) => void, onCancel: () => void) => HTMLElement
  save: (next: S) => Promise<void>
}

// Latest stored state per trigger, refreshed on every rescan, so a panel always opens on
// what's actually saved — even if it was changed from the other copy of the bar or from
// another tab since this trigger was created.
const stateByTrigger = new WeakMap<HTMLButtonElement, unknown>()

function createLegacyCaret(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('role', 'none')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('viewBox', '0 0 16 16')
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
  use.setAttribute('href', '#caret-small')
  svg.appendChild(use)
  return svg
}

function renderTrigger<S>(trigger: HTMLButtonElement, config: DropdownFilterConfig<S>, state: S, isNewStyle: boolean): void {
  stateByTrigger.set(trigger, state)
  const { text, isActive } = config.label(state)
  if (trigger.dataset.applywLabel === text && trigger.dataset.applywActive === String(isActive)) return
  trigger.dataset.applywLabel = text
  trigger.dataset.applywActive = String(isActive)

  trigger.textContent = ''
  trigger.append(text, isNewStyle ? createChevronIcon() : createLegacyCaret())
  if (isNewStyle) styleNewStylePill(trigger, isActive)
  else trigger.classList.toggle('artdeco-pill--selected', isActive)
}

function createDropdown<S>(
  config: DropdownFilterConfig<S>,
  state: S,
  isNewStyle: boolean,
  onApplied: () => void
): HTMLElement {
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-label', config.ariaLabel)

  let container: HTMLElement
  let wrapper: HTMLElement
  if (isNewStyle) {
    trigger.className = config.markerClass
    wrapper = document.createElement('div')
    Object.assign(wrapper.style, { position: 'relative', display: 'inline-flex' })
    container = wrapper
  } else {
    trigger.id = config.legacyId
    trigger.className = `${config.markerClass} artdeco-pill artdeco-pill--slate artdeco-pill--choice artdeco-pill--2 search-reusables__filter-pill-button`
    container = document.createElement('li')
    container.className = 'search-reusables__primary-filter'
    wrapper = document.createElement('div')
    wrapper.className = 'search-reusables__filter-trigger-and-dropdown'
    wrapper.style.position = 'relative'
    container.appendChild(wrapper)
  }
  renderTrigger(trigger, config, state, isNewStyle)

  let panel: HTMLElement | null = null

  const handleOutsideClick = (event: MouseEvent): void => {
    if (panel && !wrapper.contains(event.target as Node)) closePanel()
  }
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closePanel()
  }

  function closePanel(): void {
    panel?.remove()
    panel = null
    trigger.setAttribute('aria-expanded', 'false')
    document.removeEventListener('mousedown', handleOutsideClick, true)
    document.removeEventListener('keydown', handleKeydown, true)
  }

  function openPanel(): void {
    panel = config.createPanel(
      stateByTrigger.get(trigger) as S,
      (next) => {
        renderTrigger(trigger, config, next, isNewStyle)
        closePanel()
        void config.save(next).then(onApplied)
      },
      closePanel
    )
    wrapper.appendChild(panel)
    trigger.setAttribute('aria-expanded', 'true')
    document.addEventListener('mousedown', handleOutsideClick, true)
    document.addEventListener('keydown', handleKeydown, true)
  }

  trigger.addEventListener('click', () => {
    if (panel) closePanel()
    else openPanel()
  })

  // The new-style bar is a React tree with its own handlers; keep clicks and typing inside
  // our dropdown (e.g. Enter in the keyword input) from reaching them.
  if (isNewStyle) {
    for (const type of ['click', 'keydown'] as const) wrapper.addEventListener(type, (event) => event.stopPropagation())
  }

  wrapper.insertBefore(trigger, wrapper.firstChild)
  return container
}

// Adds the dropdown to every copy of the filter bar that doesn't have it yet, and refreshes
// the label of every copy that does. Presence is read off the live DOM, not a flag on the
// bar: the bar is React-rendered and rebuilt on client-side route changes (see
// filterToggles.ts), and a flag would survive on the detached node.
export function syncDropdownFilter<S>(config: DropdownFilterConfig<S>, state: S, onApplied: () => void): void {
  for (const bar of findAllFilterBars()) {
    if (!hasRenderedChips(bar)) continue
    const isNewStyle = isNewStyleFilterBar(bar)
    const existing = bar.querySelector<HTMLButtonElement>(`.${config.markerClass}`)
    if (existing) renderTrigger(existing, config, state, isNewStyle)
    else bar.insertBefore(createDropdown(config, state, isNewStyle, onApplied), findPillInsertionPoint(bar))
  }
}
