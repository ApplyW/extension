import { getMustExcludeWords, getMustIncludeWords, setMustExcludeWords, setMustIncludeWords } from '../shared/storage'
import { findFilterBar } from './filterBar'

const INJECTED_ATTR = 'data-applyw-keyword-filter-injected'

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
  initialInclude: Set<string>,
  initialExclude: Set<string>,
  onApply: (include: Set<string>, exclude: Set<string>) => void,
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

  const include = createWordListSection('Must include', 'e.g. Java — press Enter', initialInclude)
  const exclude = createWordListSection('Must exclude', 'e.g. Junior — press Enter', initialExclude)

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
  applyButton.addEventListener('click', () => onApply(include.words, exclude.words))

  footer.append(cancelButton, applyButton)
  panel.append(include.section, exclude.section, footer)
  return panel
}

function createCaretIcon(): SVGSVGElement {
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

function updateTriggerLabel(trigger: HTMLButtonElement, include: Set<string>, exclude: Set<string>): void {
  const count = include.size + exclude.size
  trigger.textContent = ''
  trigger.append(count > 0 ? `Keywords (${count})` : 'Keywords', createCaretIcon())
  trigger.classList.toggle('artdeco-pill--selected', count > 0)
}

// Injects a "Keywords" filter pill + dropdown into LinkedIn's own top filter bar: two word
// lists — "Must include" and "Must exclude" — matched against a job's full description
// (whole-word, case-insensitive; see isHiddenByKeywords in jobCard.ts). Same staged
// dropdown pattern as the language filter (see languageFilter.ts) — the panel isn't a
// clone of LinkedIn's own dropdown component, whose position is computed by JS we don't have.
export async function injectKeywordFilter(onApplied: () => void): Promise<void> {
  const filterList = findFilterBar()
  if (!filterList || filterList.hasAttribute(INJECTED_ATTR)) return
  filterList.setAttribute(INJECTED_ATTR, 'true')

  let [mustInclude, mustExclude] = await Promise.all([getMustIncludeWords(), getMustExcludeWords()])

  const li = document.createElement('li')
  li.className = 'search-reusables__primary-filter'

  const wrapper = document.createElement('div')
  wrapper.className = 'search-reusables__filter-trigger-and-dropdown'
  wrapper.style.position = 'relative'

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.id = 'applyw-keyword-filter'
  trigger.className =
    'artdeco-pill artdeco-pill--slate artdeco-pill--choice artdeco-pill--2 search-reusables__filter-pill-button'
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute(
    'aria-label',
    'Keyword filter. Clicking this button displays description must-include and must-exclude word filters.'
  )
  updateTriggerLabel(trigger, mustInclude, mustExclude)

  let panel: HTMLDivElement | null = null

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
    panel = createPanel(
      mustInclude,
      mustExclude,
      (nextInclude, nextExclude) => {
        mustInclude = nextInclude
        mustExclude = nextExclude
        updateTriggerLabel(trigger, mustInclude, mustExclude)
        closePanel()
        void Promise.all([setMustIncludeWords(mustInclude), setMustExcludeWords(mustExclude)]).then(onApplied)
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

  wrapper.appendChild(trigger)
  li.appendChild(wrapper)
  filterList.appendChild(li)
}
