import { setSelectedLanguages } from '../shared/storage'
import { syncDropdownFilter, type DropdownFilterConfig } from './filterDropdown'

// Common languages chrome.i18n.detectLanguage can return. Not exhaustive by design —
// extend this list if a language you need to filter by isn't here.
const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'hi', name: 'Hindi' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'cs', name: 'Czech' },
  { code: 'el', name: 'Greek' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sr', name: 'Serbian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' }
]

function styleFooterButton(button: HTMLButtonElement): void {
  Object.assign(button.style, {
    font: 'inherit',
    padding: '4px 12px',
    borderRadius: '16px',
    border: '1px solid currentColor',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer'
  })
}

function createSearchInput(onFilter: (query: string) => void): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Search languages'
  Object.assign(input.style, {
    boxSizing: 'border-box',
    width: '100%',
    padding: '6px 8px',
    marginBottom: '8px',
    borderRadius: '4px',
    border: '1px solid rgba(128, 128, 128, 0.4)',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit'
  })
  input.addEventListener('input', () => onFilter(input.value.trim().toLowerCase()))
  return input
}

function createLanguageRow(
  language: { code: string; name: string },
  isChecked: boolean,
  onToggle: (code: string, checked: boolean) => void
): { row: HTMLLIElement; matchesQuery: (query: string) => boolean } {
  const row = document.createElement('li')
  Object.assign(row.style, { listStyle: 'none', padding: '4px 0' })

  const label = document.createElement('label')
  Object.assign(label.style, { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' })

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = isChecked
  // Visually hidden but still the real, keyboard/screen-reader-accessible control — LinkedIn's
  // page CSS resets native checkbox appearance globally (it draws its own custom checkboxes
  // elsewhere via its own classes), which silently ate ours too. The box below is drawn by us
  // so it renders regardless of that reset.
  Object.assign(checkbox.style, { position: 'absolute', width: '1px', height: '1px', opacity: '0', margin: '0' })

  const box = document.createElement('span')
  Object.assign(box.style, {
    flex: '0 0 auto',
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    border: '1px solid CanvasText',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    lineHeight: '1'
  })

  const renderBox = (checked: boolean): void => {
    box.textContent = checked ? '✓' : ''
    box.style.background = checked ? 'CanvasText' : 'transparent'
    box.style.color = checked ? 'Canvas' : 'transparent'
  }
  renderBox(isChecked)

  checkbox.addEventListener('change', () => {
    renderBox(checkbox.checked)
    onToggle(language.code, checkbox.checked)
  })

  const text = document.createElement('span')
  text.textContent = language.name

  label.append(checkbox, box, text)
  row.appendChild(label)

  const lowerName = language.name.toLowerCase()
  return { row, matchesQuery: (query) => lowerName.includes(query) }
}

// Staged selection: checkbox changes only take effect on Apply, matching LinkedIn's own
// filter dropdowns (e.g. Company) which stage changes behind Apply/Cancel rather than
// applying each click immediately.
function createPanel(
  initialSelection: Set<string>,
  onApply: (selection: Set<string>) => void,
  onCancel: () => void
): HTMLDivElement {
  const pendingSelection = new Set(initialSelection)

  const panel = document.createElement('div')
  Object.assign(panel.style, {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: '0',
    zIndex: '1000',
    display: 'flex',
    flexDirection: 'column',
    width: '260px',
    maxHeight: '360px',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'Canvas',
    color: 'CanvasText',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
  })

  const list = document.createElement('ul')
  Object.assign(list.style, { listStyle: 'none', margin: '0', padding: '0', overflowY: 'auto', flex: '1 1 auto' })

  const rows = LANGUAGES.map((language) => {
    const { row, matchesQuery } = createLanguageRow(language, pendingSelection.has(language.code), (code, checked) => {
      if (checked) pendingSelection.add(code)
      else pendingSelection.delete(code)
    })
    list.appendChild(row)
    return { row, matchesQuery }
  })

  const searchInput = createSearchInput((query) => {
    rows.forEach(({ row, matchesQuery }) => {
      row.style.display = matchesQuery(query) ? '' : 'none'
    })
  })

  const footer = document.createElement('div')
  Object.assign(footer.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(128, 128, 128, 0.25)'
  })

  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.textContent = 'Cancel'
  styleFooterButton(cancelButton)
  cancelButton.addEventListener('click', onCancel)

  const applyButton = document.createElement('button')
  applyButton.type = 'button'
  applyButton.textContent = 'Apply'
  styleFooterButton(applyButton)
  applyButton.addEventListener('click', () => onApply(pendingSelection))

  footer.append(cancelButton, applyButton)
  panel.append(searchInput, list, footer)
  return panel
}

// A "Language" filter pill + dropdown in LinkedIn's own top filter bar, on both page
// designs: trigger pill, then a panel with a search box, checkbox list and Cancel/Apply,
// like LinkedIn's Company/Date Posted dropdowns. The panel is custom-styled rather than a
// clone of LinkedIn's artdeco-hoverable-content, whose position is computed by LinkedIn's
// own JS. Matching needs each job's description (see jobCard.ts and pageBridge.ts).
const LANGUAGE_FILTER: DropdownFilterConfig<Set<string>> = {
  markerClass: 'applyw-language-filter',
  legacyId: 'applyw-language-filter',
  ariaLabel: 'Language filter. Clicking this button displays all Language filter options.',
  label: (selection) => ({
    text: selection.size > 0 ? `Language (${selection.size})` : 'Language',
    isActive: selection.size > 0
  }),
  createPanel,
  save: setSelectedLanguages
}

export function syncLanguageFilter(selection: Set<string>, onApplied: () => void): void {
  syncDropdownFilter(LANGUAGE_FILTER, selection, onApplied)
}
