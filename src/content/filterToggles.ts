import { getSettings, setSetting, type Settings } from '../shared/storage'
import { findFilterBar } from './filterBar'

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
function createTogglePill(config: ToggleConfig, isChecked: boolean, onToggle: (next: boolean) => void): HTMLLIElement {
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

// Injects Hide Applied / Hide Viewed toggle pills once, at the end of LinkedIn's top
// filter bar. `onSettingsChanged` is called after a toggle's new value is persisted, so
// the caller can re-run hidden-state checks against the whole card list.
export async function injectFilterToggles(onSettingsChanged: () => void): Promise<void> {
  const filterList = findFilterBar()
  if (!filterList || filterList.hasAttribute(INJECTED_ATTR)) return

  const settings = await getSettings()

  TOGGLES.forEach((config) => {
    const pill = createTogglePill(config, settings[config.settingKey], (next) => {
      void setSetting(config.settingKey, next).then(onSettingsChanged)
    })
    filterList.appendChild(pill)
  })

  filterList.setAttribute(INJECTED_ATTR, 'true')
}
