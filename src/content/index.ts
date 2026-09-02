import { getHiddenJobIds } from './storage'
import { JOB_CARD_SELECTOR, applyHiddenState, injectHideButton } from './jobCard'

console.log('ApplyW loaded')

async function scanForCards(): Promise<void> {
  const hiddenJobIds = await getHiddenJobIds()
  document.querySelectorAll<HTMLElement>(JOB_CARD_SELECTOR).forEach((card) => {
    applyHiddenState(card, hiddenJobIds)
    injectHideButton(card)
  })
}

// Batches bursts of mutations from infinite scroll into a single rescan.
function observeJobList(): void {
  let rescanTimer: ReturnType<typeof setTimeout> | undefined

  const observer = new MutationObserver((mutations) => {
    const hasNewCards = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some(
        (node) =>
          node instanceof HTMLElement &&
          (node.matches(JOB_CARD_SELECTOR) || node.querySelector(JOB_CARD_SELECTOR))
      )
    )
    if (!hasNewCards) return

    clearTimeout(rescanTimer)
    rescanTimer = setTimeout(() => void scanForCards(), 200)
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

void scanForCards()
observeJobList()
