import { getBlockedCompanies, getHiddenJobIds, getSelectedLanguages, getSettings } from '../shared/storage'
import { JOB_CARD_SELECTOR, applyHiddenState, injectActionButtons } from './jobCard'
import { injectFilterToggles } from './filterToggles'
import { injectLanguageFilter } from './languageFilter'

console.log('ApplyW loaded')

let rescanTimer: ReturnType<typeof setTimeout> | undefined

// Debounced so a burst of DOM mutations, or several job languages resolving back to
// back, collapse into a single rescan instead of one each.
function scheduleRescan(): void {
  clearTimeout(rescanTimer)
  rescanTimer = setTimeout(() => void scanForCards(), 200)
}

async function scanForCards(): Promise<void> {
  const [hiddenJobIds, blockedCompanies, settings, selectedLanguages] = await Promise.all([
    getHiddenJobIds(),
    getBlockedCompanies(),
    getSettings(),
    getSelectedLanguages()
  ])
  document.querySelectorAll<HTMLElement>(JOB_CARD_SELECTOR).forEach((card) => {
    applyHiddenState(card, hiddenJobIds, blockedCompanies, settings, selectedLanguages, scheduleRescan)
    injectActionButtons(card)
  })
  void injectFilterToggles(scheduleRescan)
  void injectLanguageFilter(scheduleRescan)
}

// Triggers on *any* subtree change under <body>, not just whole new cards being added:
// LinkedIn virtualizes this list, so a card already in the DOM can have its inner content
// torn down and rebuilt as it scrolls in/out of view. scanForCards() is idempotent, so
// rescanning on every batch is safe — scheduleRescan() just debounces it to stay cheap.
function observeJobList(): void {
  const observer = new MutationObserver(scheduleRescan)
  observer.observe(document.body, { childList: true, subtree: true })
}

void scanForCards()
observeJobList()

// Re-apply hidden state when the popup edits blocked companies / hidden jobs (e.g.
// unblocking a company), so the page reflects it without needing a reload.
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local') scheduleRescan()
})
