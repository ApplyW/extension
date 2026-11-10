import { setMustExcludeWords, setMustIncludeWords } from '../shared/storage'
import { syncDropdownFilter, type DropdownFilterConfig } from './filterDropdown'

interface KeywordSelection {
  include: Set<string>
  exclude: Set<string>
}

// Normalized (trimmed, lowercased) — same known rough edge as blocked company display
// (see storage.ts): what's typed is what gets shown, lowercased.
function normalizeKeyword(word: string): string {
  return word.trim().toLowerCase()
}

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

function createChip(word: string, onRemove: () => void): HTMLSpanElement {
  const chip = document.createElement('span')
  Object.assign(chip.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px 2px 10px',
    margin: '0 6px 6px 0',
    borderRadius: '12px',
    border: '1px solid rgba(128, 128, 128, 0.4)',
    fontSize: '13px'
  })
  chip.textContent = word

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.textContent = '×'
  remove.setAttribute('aria-label', `Remove ${word}`)
  Object.assign(remove.style, {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '1',
    padding: '0 2px'
  })
  remove.addEventListener('click', onRemove)

  chip.appendChild(remove)
  return chip
}

// A labeled word-list editor: type a word, press Enter to add it as a removable chip.
// Mirrors the language filter's staged-until-Apply pattern — the caller reads `words`
// only when Apply is clicked.
function createWordListSection(
  label: string,
  placeholder: string,
  initialWords: Set<string>
): { section: HTMLDivElement; words: Set<string> } {
  const words = new Set(initialWords)

  const section = document.createElement('div')
  Object.assign(section.style, { marginBottom: '10px' })

  const heading = document.createElement('div')
  heading.textContent = label
  Object.assign(heading.style, { fontSize: '12px', fontWeight: '600', marginBottom: '6px', opacity: '0.75' })

  const chipList = document.createElement('div')
  Object.assign(chipList.style, { display: 'flex', flexWrap: 'wrap' })

  const renderChips = (): void => {
    chipList.replaceChildren()
    words.forEach((word) => {
      chipList.appendChild(
        createChip(word, () => {
          words.delete(word)
          renderChips()
        })
      )
    })
  }
  renderChips()

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = placeholder
  Object.assign(input.style, {
    boxSizing: 'border-box',
    width: '100%',
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(128, 128, 128, 0.4)',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit'
  })
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const word = normalizeKeyword(input.value)
    if (word) {
      words.add(word)
      renderChips()
    }
    input.value = ''
  })

  section.append(heading, chipList, input)
  return { section, words }
}

function createPanel(
  initial: KeywordSelection,
  onApply: (next: KeywordSelection) => void,
  onCancel: () => void
): HTMLDivElement {
  const panel = document.createElement('div')
  Object.assign(panel.style, {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: '0',
    zIndex: '1000',
    display: 'flex',
    flexDirection: 'column',
    width: '280px',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'Canvas',
    color: 'CanvasText',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
  })

  const include = createWordListSection('Must include', 'e.g. Java — press Enter', initial.include)
  const exclude = createWordListSection('Must exclude', 'e.g. Junior — press Enter', initial.exclude)

  const footer = document.createElement('div')
  Object.assign(footer.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
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
  applyButton.addEventListener('click', () => onApply({ include: include.words, exclude: exclude.words }))

  footer.append(cancelButton, applyButton)
  panel.append(include.section, exclude.section, footer)
  return panel
}

// A "Keywords" filter pill + dropdown in LinkedIn's own top filter bar, on both page
// designs: "Must include" and "Must exclude" word lists, matched whole-word and
// case-insensitively against a job's title and description (see evaluateKeywords in
// jobCard.ts). Same staged dropdown as the language filter (see languageFilter.ts).
const KEYWORD_FILTER: DropdownFilterConfig<KeywordSelection> = {
  markerClass: 'applyw-keyword-filter',
  legacyId: 'applyw-keyword-filter',
  ariaLabel: 'Keyword filter. Clicking this button displays description must-include and must-exclude word filters.',
  label: ({ include, exclude }) => {
    const count = include.size + exclude.size
    return { text: count > 0 ? `Keywords (${count})` : 'Keywords', isActive: count > 0 }
  },
  createPanel,
  save: async ({ include, exclude }) => {
    await Promise.all([setMustIncludeWords(include), setMustExcludeWords(exclude)])
  }
}

export function syncKeywordFilter(selection: KeywordSelection, onApplied: () => void): void {
  syncDropdownFilter(KEYWORD_FILTER, selection, onApplied)
}
