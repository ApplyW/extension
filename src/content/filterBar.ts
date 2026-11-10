const FILTER_PILL_SELECTOR = 'li.search-reusables__primary-filter'
// A LinkedIn-assigned id on the new-style search-results page (see jobCard.ts's dual-DOM
// note), not a style hash — confirmed from real dumps of that page's filter bar.
export const NEW_FILTER_BAR_ID = 'JobsSearchFilters'
// From a real dump: #JobsSearchFilters > div (display:contents) > nav, and the <nav> itself
// is the chips row — its children are the "Jobs" radiogroup, one display:contents wrapper
// per chip, then the "All filters" button. The previous `nav > div > div` matched the chip
// inside every wrapper, so the toggles were appended after each chip (issue #2).
const NEW_CHIPS_ROW_SELECTOR = `#${NEW_FILTER_BAR_ID} nav`
// Also a LinkedIn-assigned key, not a hash. New pills go before it so they sit with the chips.
const ALL_FILTERS_BUTTON_SELECTOR = ':scope > [componentkey="SearchResults_AllFiltersButton"]'

function findLegacyFilterBar(): Element | null {
  const filterPills = document.querySelectorAll(FILTER_PILL_SELECTOR)
  return filterPills[filterPills.length - 1]?.parentElement ?? null
}

// LinkedIn's own top filter bar (Date Posted, Experience level, Easy Apply, ...).
// - Legacy page: we don't know the wrapping <ul>'s own class name, so it's located via an
//   existing filter pill rather than a guessed container selector.
// - New-style page: see NEW_CHIPS_ROW_SELECTOR. The id appears *twice* in the same document
//   (a sticky-header duplicate of the bar) — findAllFilterBars returns both.
export function findAllFilterBars(): Element[] {
  const legacyBar = findLegacyFilterBar()
  if (legacyBar) return [legacyBar]
  return Array.from(document.querySelectorAll(NEW_CHIPS_ROW_SELECTOR))
}

// Where a new pill should go in `bar`: before "All filters" on the new-style page, or at
// the end (null, for insertBefore) when there's no such button, as on the legacy page.
export function findPillInsertionPoint(bar: Element): Element | null {
  return bar.querySelector(ALL_FILTERS_BUTTON_SELECTOR)
}

export function isNewStyleFilterBar(bar: Element): boolean {
  return bar.closest(`#${NEW_FILTER_BAR_ID}`) !== null
}

// The new-style bar can transiently match while LinkedIn is still rendering it, before any
// chips are in; injecting there drops our controls somewhere that never becomes the visible
// row. The observer rescans once the chips arrive, since that is itself a mutation.
export function hasRenderedChips(bar: Element): boolean {
  return bar.childElementCount > 0
}
