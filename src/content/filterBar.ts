const FILTER_PILL_SELECTOR = 'li.search-reusables__primary-filter'
// A LinkedIn-assigned id on the new-style search-results page (see jobCard.ts's dual-DOM
// note), not a style hash — confirmed from two real dumps of that page's filter bar.
export const NEW_FILTER_BAR_ID = 'JobsSearchFilters'
// Two independent dumps confirmed the same path from that id down to the row holding the
// individual filter chips: #JobsSearchFilters > nav > div (a display:contents wrapper) >
// div (the actual chips row). Deliberately not anchored on any one chip's role — one dump
// had a `role="radiogroup"` chip ("Jobs") among the others, the other had none at all
// (different searches surface different facets), so a selector keyed to that role would
// miss the bar entirely whenever no radio-style facet happens to be present.
const NEW_CHIPS_ROW_SELECTOR = `#${NEW_FILTER_BAR_ID} nav > div > div`

// LinkedIn's own top filter bar (Date Posted, Experience level, Easy Apply, ...).
// - Legacy page: we don't know the wrapping <ul>'s own class name, so it's located via an
//   existing filter pill rather than a guessed container selector.
// - New-style page: see NEW_CHIPS_ROW_SELECTOR above. The id has been seen appearing
//   *twice* in the same document (a sticky-header duplicate of the bar) — every match is
//   returned so a caller can inject into both rather than only whichever comes first.
export function findFilterBar(): Element | null {
  const filterPills = document.querySelectorAll(FILTER_PILL_SELECTOR)
  const legacyBar = filterPills[filterPills.length - 1]?.parentElement
  if (legacyBar) return legacyBar
  return document.querySelector(NEW_CHIPS_ROW_SELECTOR)
}

// Same as findFilterBar(), but returns every match rather than just the first — needed on
// the new-style page since #JobsSearchFilters can appear twice (see above). Falls back to
// the single legacy result wrapped in an array, so callers can use this exclusively.
export function findAllFilterBars(): Element[] {
  const filterPills = document.querySelectorAll(FILTER_PILL_SELECTOR)
  const legacyBar = filterPills[filterPills.length - 1]?.parentElement
  if (legacyBar) return [legacyBar]
  return Array.from(document.querySelectorAll(NEW_CHIPS_ROW_SELECTOR))
}
