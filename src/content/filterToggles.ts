import { getSettings, setSetting, type Settings } from '../shared/storage'
import { findAllFilterBars, NEW_FILTER_BAR_ID } from './filterBar'

// Carried by both pill designs, and the only record that a bar already has its toggles —
// see injectFilterToggles for why that's read back off the live DOM rather than a flag.
const TOGGLE_MARKER_CLASS = 'applyw-filter-toggle'

interface ToggleConfig {
  id: string
  label: string
  settingKey: keyof Settings
}

const TOGGLES: ToggleConfig[] = [
  { id: 'applyw-hide-applied-filter', label: 'Hide Applied', settingKey: 'hideApplied' },
  { id: 'applyw-hide-viewed-filter', label: 'Hide Viewed', settingKey: 'hideViewed' }
]

function setCheckedState(button: HTMLButtonElement, checked: boolean): void {
  button.setAttribute('aria-checked', String(checked))
  button.classList.toggle('artdeco-pill--selected', checked)
}

// Markup mirrors a real LinkedIn filter pill (artdeco-pill / search-reusables__filter-*
// classes) so it inherits LinkedIn's own styling instead of needing our own CSS.
function createLegacyTogglePill(config: ToggleConfig, isChecked: boolean, onToggle: (next: boolean) => void): HTMLLIElement {
  const li = document.createElement('li')
  li.className = `search-reusables__primary-filter ${TOGGLE_MARKER_CLASS}`

  const wrapper = document.createElement('div')
  wrapper.className = 'search-reusables__filter-binary-toggle'

  const button = document.createElement('button')
  button.type = 'button'
  button.id = config.id
  button.className =
    'artdeco-pill artdeco-pill--slate artdeco-pill--2 artdeco-pill--choice ember-view search-reusables__filter-pill-button'
  button.setAttribute('role', 'radio')
  button.setAttribute('aria-label', `${config.label} filter.`)
  button.textContent = config.label
  setCheckedState(button, isChecked)

  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-checked') !== 'true'
    setCheckedState(button, next)
    onToggle(next)
  })

  wrapper.appendChild(button)
  li.appendChild(wrapper)
  return li
}

// The new-style page styles its filter chips entirely with hashed atomic-CSS class names
// (e.g. "_46f248c1"), which change every time LinkedIn rebuilds. A verbatim snapshot of a
// real chip's classes used to be copied here; once it went stale none of them matched a
// loaded rule any more and these toggles rendered as a bare native checkbox next to an
// unstyled label. Nothing below depends on a LinkedIn class name — the same choice
// jobCard.ts's new-style Hide button already makes — so their next rebuild can't break it.
// The native checkbox is gone with it: an <input> whose "hide me" class stopped applying is
// exactly what was showing through.
function styleNewStylePill(pill: HTMLButtonElement, isChecked: boolean): void {
  Object.assign(pill.style, {
    display: 'inline-flex',
    alignItems: 'center',
    height: '32px',
    marginRight: '8px',
    padding: '0 12px',
    font: 'inherit',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '20px',
    whiteSpace: 'nowrap',
    borderRadius: '16px',
    cursor: 'pointer',
    color: 'inherit',
    // Neutral grey and a translucent fill rather than fixed colours: this bar renders on
    // both LinkedIn's light and dark themes and nothing here knows which one is active.
    // Selected state is carried by the heavier border and the fill together, so it still
    // reads if one of them is washed out by whatever is behind the bar.
    border: isChecked ? '1px solid currentColor' : '1px solid rgba(128, 128, 128, 0.6)',
    background: isChecked ? 'rgba(128, 128, 128, 0.25)' : 'transparent',
    boxShadow: isChecked ? 'inset 0 0 0 1px currentColor' : 'none'
  })
}

// One toggle's DOM lives in every copy of the filter bar (see findAllFilterBars) — each
// copy gets its own independent element, so toggling one doesn't visually update the
// other's checked state until the next full rescan. Same known gap as the legacy pill,
// which never re-syncs its own appearance from a setting changed elsewhere either.
// No id is set: this bar can render twice, and two copies of the same pill would mean a
// duplicated id in the document.
function createNewStyleTogglePill(
  config: ToggleConfig,
  isChecked: boolean,
  onToggle: (next: boolean) => void
): HTMLButtonElement {
  const pill = document.createElement('button')
  pill.type = 'button'
  pill.className = TOGGLE_MARKER_CLASS
  pill.textContent = config.label
  pill.setAttribute('aria-pressed', String(isChecked))
  pill.setAttribute('aria-label', `${config.label} filter`)
  styleNewStylePill(pill, isChecked)

  pill.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const next = pill.getAttribute('aria-pressed') !== 'true'
    pill.setAttribute('aria-pressed', String(next))
    styleNewStylePill(pill, next)
    onToggle(next)
  })

  return pill
}

function isNewStyleFilterBar(container: Element): boolean {
  return container.closest(`#${NEW_FILTER_BAR_ID}`) !== null
}

// The new-style bar's selector (see NEW_CHIPS_ROW_SELECTOR in filterBar.ts) can transiently
// match a wrapper LinkedIn hasn't put any chips into yet, while it's still rendering the
// page — appending there drops the toggles somewhere that never becomes the visible filter
// row. Waiting for a bar that actually holds something costs nothing: the observer rescans
// on the next mutation, and the chips arriving is itself a mutation.
function hasRenderedChips(container: Element): boolean {
  return container.childElementCount > 0
}

// Injects Hide Applied / Hide Viewed toggle pills once, at the end of every copy of
// LinkedIn's top filter bar (see findAllFilterBars — the new-style page can render it
// twice, e.g. a sticky-header duplicate). `onSettingsChanged` is called after a toggle's
// new value is persisted, so the caller can re-run hidden-state checks against the whole
// card list.
export async function injectFilterToggles(onSettingsChanged: () => void): Promise<void> {
  // "Already done" is read back off the live DOM rather than remembered in a flag on the
  // bar, matching how jobCard.ts tracks its own buttons. This bar is React-rendered and gets
  // torn down and rebuilt — arriving at job search through LinkedIn's own UI is a
  // client-side route change that does exactly that — which takes our pills with it. A flag
  // would survive on the detached node, and the toggles would never come back for the rest
  // of that page's life.
  const filterLists = findAllFilterBars().filter(
    (list) => hasRenderedChips(list) && !list.querySelector(`.${TOGGLE_MARKER_CLASS}`)
  )
  if (filterLists.length === 0) return

  const settings = await getSettings()

  filterLists.forEach((filterList) => {
    const createPill = isNewStyleFilterBar(filterList) ? createNewStyleTogglePill : createLegacyTogglePill
    TOGGLES.forEach((config) => {
      const pill = createPill(config, settings[config.settingKey], (next) => {
        void setSetting(config.settingKey, next).then(onSettingsChanged)
      })
      filterList.appendChild(pill)
    })
  })
}
