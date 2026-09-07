import { getSettings, setSetting, type Settings } from '../shared/storage'
import { findAllFilterBars, NEW_FILTER_BAR_ID } from './filterBar'

const INJECTED_ATTR = 'data-applyw-toggles-injected'

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
  li.className = 'search-reusables__primary-filter'

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

// Classes copied verbatim from a real filter chip (role="radio" + hidden checkbox + label)
// on the new-style search-results page (see jobCard.ts's dual-DOM note) — LinkedIn's own
// hashed atomic-CSS classes, current as of that dump, not named/stable ones. If toggle
// pills stop being styled correctly there, this is the first place to refresh from a fresh
// sample, the same way the legacy pill above reuses artdeco's real class names.
const NEW_STYLE_RADIO_CLASS =
  'bacff651 ab463cd3 _1ff3476f e7fef05d _43b31d36 _11523cd1 _508938c3 c24aac50 f5ddbadc _46f248c1'
const NEW_STYLE_INNER_CLASS = '_2dce1d54 _5a57e669 c2aac373 _0f531b63 _5883b479 _0a15adc1 _63abe882 _0f531b63 _1b608c33'
const NEW_STYLE_INPUT_CLASS =
  '_4670a277 b9f2f6f5 _89d26cc9 _1ff3476f e7fef05d _43b31d36 _11523cd1 _7cd7c649 a1aa7202 c479e6bd f7a815bc'
const NEW_STYLE_LABEL_CLASS =
  'f46852c3 b040d531 ebe0e49a _63abe882 _28f52d74 a12f2e0f _5883b479 c5c9403b _698011dd _7008c76b d82dcda9 _276a5939 _15084da5 _672b96aa f5ddbadc _0f531b63 _15d5db3c _65b2dba9 fe7577f5 _1b39b523 _50f9bd52 f447e758 _24c8fc6d _25e4ab6f _2d89b717 _55f35340 _76d5a0dc _12fbcf4a acdfba62'

// One toggle's DOM lives in every copy of the filter bar (see findAllFilterBars) — each
// copy gets its own independent element, so toggling one doesn't visually update the
// other's checked state until the next full rescan. Same known gap as the legacy pill,
// which never re-syncs its own appearance from a setting changed elsewhere either.
function createNewStyleTogglePill(config: ToggleConfig, isChecked: boolean, onToggle: (next: boolean) => void): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-display-contents', 'true')

  const radio = document.createElement('div')
  radio.setAttribute('role', 'radio')
  radio.setAttribute('tabindex', '0')
  radio.className = NEW_STYLE_RADIO_CLASS
  radio.setAttribute('aria-label', `Filter by ${config.label}`)
  radio.setAttribute('aria-checked', String(isChecked))

  const inner = document.createElement('div')
  inner.className = NEW_STYLE_INNER_CLASS
  inner.setAttribute('aria-label', `Filter by ${config.label}`)

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.className = NEW_STYLE_INPUT_CLASS
  input.tabIndex = -1
  input.checked = isChecked

  const label = document.createElement('label')
  label.className = NEW_STYLE_LABEL_CLASS
  label.textContent = config.label

  inner.append(input, label)
  radio.appendChild(inner)
  wrapper.appendChild(radio)

  // No id/for pairing between input and label (each copy of this pill — see
  // findAllFilterBars — would otherwise duplicate the same id across the document, and a
  // label's native "activate my paired control" behaviour fires a second, separate click at
  // the input, which is easy to double-count). Without that pairing, a click anywhere in
  // the pill is exactly one plain click bubbling to this single listener — except a click
  // landing directly on the input, which the browser toggles on its own before this even
  // runs, so that case just reads the already-new value instead of flipping it again.
  radio.addEventListener('click', (event) => {
    const next = event.target === input ? input.checked : !input.checked
    input.checked = next
    radio.setAttribute('aria-checked', String(next))
    onToggle(next)
  })

  return wrapper
}

function isNewStyleFilterBar(container: Element): boolean {
  return container.closest(`#${NEW_FILTER_BAR_ID}`) !== null
}

// Injects Hide Applied / Hide Viewed toggle pills once, at the end of every copy of
// LinkedIn's top filter bar (see findAllFilterBars — the new-style page can render it
// twice, e.g. a sticky-header duplicate). `onSettingsChanged` is called after a toggle's
// new value is persisted, so the caller can re-run hidden-state checks against the whole
// card list.
export async function injectFilterToggles(onSettingsChanged: () => void): Promise<void> {
  const filterLists = findAllFilterBars().filter((list) => !list.hasAttribute(INJECTED_ATTR))
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
    filterList.setAttribute(INJECTED_ATTR, 'true')
  })
}
