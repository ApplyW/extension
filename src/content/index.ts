import { getBlockedCompanies, getHiddenJobIds, getSettings } from '../shared/storage'
import { JOB_CARD_SELECTOR, applyHiddenState, injectActionButtons } from './jobCard'
import { injectFilterToggles } from './filterToggles'

console.log('ApplyW loaded')

async function scanForCards(): Promise<void> {
  const [hiddenJobIds, blockedCompanies, settings] = await Promise.all([
    getHiddenJobIds(),
    getBlockedCompanies(),
    getSettings()
  ])
  document.querySelectorAll<HTMLElement>(JOB_CARD_SELECTOR).forEach((card) => {
    applyHiddenState(card, hiddenJobIds, blockedCompanies, settings)
    injectActionButtons(card)
  })
  void injectFilterToggles(() => void scanForCards())
}

// Batches bursts of mutations into a single rescan. Triggers on *any* subtree change,
// not just whole new cards being added: LinkedIn virtualizes this list, so a card
// already in the DOM can have its inner content torn down and rebuilt as it scrolls
// in/out of view. Filtering to "did a new card element show up" missed those rebuilds
// and left recycled cards unprocessed — scanForCards() is idempotent, so rescanning on
// every batch is safe, just debounced to stay cheap.
function observeJobList(): void {
  let rescanTimer: ReturnType<typeof setTimeout> | undefined

  const observer = new MutationObserver(() => {
    clearTimeout(rescanTimer)
    rescanTimer = setTimeout(() => void scanForCards(), 200)
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

void scanForCards()
observeJobList()

// Re-apply hidden state when the popup edits blocked companies / hidden jobs (e.g.
// unblocking a company), so the page reflects it without needing a reload.
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local') void scanForCards()
})
