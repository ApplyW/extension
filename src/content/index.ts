import {
  getBlockedCompanies,
  getHiddenJobIds,
  getMustExcludeWords,
  getMustIncludeWords,
  getSelectedLanguages,
  getSettings
} from '../shared/storage'
import { JOB_CARD_SELECTOR, applyHiddenState, injectActionButtons } from './jobCard'
import { injectFilterToggles } from './filterToggles'
import { injectLanguageFilter } from './languageFilter'
import { injectKeywordFilter } from './keywordFilter'
import { syncTopCardBlockButton } from './topCardBlockButton'
import { listenForJobDescriptions } from './jobDescriptions'

console.log('ApplyW loaded')

let rescanTimer: ReturnType<typeof setTimeout> | undefined
let domObserver: MutationObserver | undefined
let hasStoppedForInvalidatedContext = false

// Reloading/updating the extension severs an already-open tab's connection to chrome.*
// APIs — chrome.runtime.id reads as undefined once that's happened, with no exception
// thrown, which is what makes it usable as a cheap check before every rescan. Without
// this, a stale tab would keep retrying (and failing) on every scroll/DOM change for the
// rest of its life instead of stopping once and telling the user to refresh.
function stopForInvalidatedContext(): void {
  if (hasStoppedForInvalidatedContext) return
  hasStoppedForInvalidatedContext = true
  clearTimeout(rescanTimer)
  domObserver?.disconnect()
  console.warn('ApplyW: the extension was updated — refresh this page to keep using ApplyW.')
}

// Debounced so a burst of DOM mutations, or several job languages resolving back to
// back, collapse into a single rescan instead of one each.
function scheduleRescan(): void {
  if (hasStoppedForInvalidatedContext) return
  clearTimeout(rescanTimer)
  rescanTimer = setTimeout(() => void scanForCards(), 200)
}

async function scanForCards(): Promise<void> {
  if (!chrome.runtime?.id) {
    stopForInvalidatedContext()
    return
  }

  let hiddenJobIds, blockedCompanies, settings, selectedLanguages, mustIncludeWords, mustExcludeWords
  try {
    ;[hiddenJobIds, blockedCompanies, settings, selectedLanguages, mustIncludeWords, mustExcludeWords] =
      await Promise.all([
        getHiddenJobIds(),
        getBlockedCompanies(),
        getSettings(),
        getSelectedLanguages(),
        getMustIncludeWords(),
        getMustExcludeWords()
      ])
  } catch {
    stopForInvalidatedContext()
    return
  }

  document.querySelectorAll<HTMLElement>(JOB_CARD_SELECTOR).forEach((card) => {
    applyHiddenState(card, hiddenJobIds, blockedCompanies, settings, selectedLanguages, mustIncludeWords, mustExcludeWords)
    injectActionButtons(card)
  })
  void injectFilterToggles(scheduleRescan)
  void injectLanguageFilter(scheduleRescan)
  void injectKeywordFilter(scheduleRescan)
  syncTopCardBlockButton(blockedCompanies, scheduleRescan)
}

// Triggers on *any* subtree change under <body>, not just whole new cards being added:
// LinkedIn virtualizes this list, so a card already in the DOM can have its inner content
// torn down and rebuilt as it scrolls in/out of view. scanForCards() is idempotent, so
// rescanning on every batch is safe — scheduleRescan() just debounces it to stay cheap.
function observeJobList(): void {
  domObserver = new MutationObserver(scheduleRescan)
  domObserver.observe(document.body, { childList: true, subtree: true })
}

void scanForCards()
observeJobList()

// Re-apply hidden state when the popup edits blocked companies / hidden jobs (e.g.
// unblocking a company), so the page reflects it without needing a reload.
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local') scheduleRescan()
})

// Rescans when pageBridge.ts (a MAIN-world script) hands over a job's full description,
// so language detection can upgrade from the title-based guess to the real thing.
listenForJobDescriptions(scheduleRescan)
