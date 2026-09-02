const FILTER_PILL_SELECTOR = 'li.search-reusables__primary-filter'

// LinkedIn's own top filter bar (Date Posted, Experience level, Easy Apply, ...) — we don't
// know the wrapping <ul>'s own class name, so it's located via an existing filter pill
// rather than a guessed container selector.
export function findFilterBar(): Element | null {
  const filterPills = document.querySelectorAll(FILTER_PILL_SELECTOR)
  return filterPills[filterPills.length - 1]?.parentElement ?? null
}
