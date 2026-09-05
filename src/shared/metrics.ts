// Counts of how many jobs each filter took out of your results, so it's possible to see
// which ones are actually earning their keep.
//
// Two rules make the numbers honest:
//
// 1. A job is counted once, ever — the first time it is hidden, under whichever reason
//    applied at that moment. applyHiddenState() runs on every rescan for every card and
//    LinkedIn recycles cards constantly, so without this a single job would be counted
//    hundreds of times as you scroll.
// 2. Exactly one reason per job, by the precedence in PRIMARY_REASON_ORDER. A job can be
//    from a blocked company *and* match an excluded word; counting both would make the
//    parts add up to more than the whole and the comparison meaningless.
//
// The per-word tallies are a separate question ("how many jobs did this word catch?") and
// deliberately do not partition the total: one job can be caught by several words at once,
// so those numbers can sum to more than the excluded-word count.

const COUNTS_KEY = 'applyw:metricCounts'
const WORDS_KEY = 'applyw:metricWordCounts'
const SEEN_KEY = 'applyw:metricSeenJobIds'

// Bounds what the seen list can grow to. Past this, the oldest ids are forgotten and such
// a job could be counted a second time if it ever resurfaces — an acceptable trade against
// growing this key without limit, given chrome.storage.local's 10MB cap.
const MAX_REMEMBERED_JOBS = 5000

// Writes are batched: a scan can hide dozens of cards at once, and each one should not be
// its own storage round-trip.
const FLUSH_DELAY_MS = 1000

export type HideReason =
  | 'manual'
  | 'company'
  | 'excludedWord'
  | 'missingWord'
  | 'language'
  | 'applied'
  | 'viewed'

// Most deliberate first: an explicit Hide outranks a company block, which outranks the
// word filters, which outrank the passive ones.
export const PRIMARY_REASON_ORDER: HideReason[] = [
  'manual',
  'company',
  'excludedWord',
  'missingWord',
  'language',
  'applied',
  'viewed'
]

export const REASON_LABELS: Record<HideReason, string> = {
  manual: 'Hidden by you',
  company: 'Blocked company',
  excludedWord: 'Excluded word',
  missingWord: 'Missing required word',
  language: 'Language filter',
  applied: 'Already applied',
  viewed: 'Already viewed'
}

export interface Metrics {
  counts: Record<HideReason, number>
  excludedWordCounts: Record<string, number>
  total: number
}

const EMPTY_COUNTS: Record<HideReason, number> = {
  manual: 0,
  company: 0,
  excludedWord: 0,
  missingWord: 0,
  language: 0,
  applied: 0,
  viewed: 0
}

let seenJobIds: Set<string> | null = null
let readyPromise: Promise<void> | null = null
let pendingCounts: Partial<Record<HideReason, number>> = {}
let pendingWords: Record<string, number> = {}
let pendingJobIds: string[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = chrome.storage.local
      .get(SEEN_KEY)
      .then((result) => {
        seenJobIds = new Set<string>(result[SEEN_KEY] ?? [])
      })
      .catch(() => {
        // Extension context gone. An empty set means nothing is double-counted in this
        // tab's remaining lifetime, which is the safe direction to fail in.
        seenJobIds = new Set<string>()
      })
  }
  return readyPromise
}

async function flush(): Promise<void> {
  const counts = pendingCounts
  const words = pendingWords
  const jobIds = pendingJobIds
  pendingCounts = {}
  pendingWords = {}
  pendingJobIds = []

  if (!chrome.runtime?.id) return

  try {
    const stored = await chrome.storage.local.get([COUNTS_KEY, WORDS_KEY, SEEN_KEY])

    const nextCounts: Record<string, number> = { ...(stored[COUNTS_KEY] ?? {}) }
    for (const [reason, delta] of Object.entries(counts)) {
      nextCounts[reason] = (nextCounts[reason] ?? 0) + delta
    }

    const nextWords: Record<string, number> = { ...(stored[WORDS_KEY] ?? {}) }
    for (const [word, delta] of Object.entries(words)) {
      nextWords[word] = (nextWords[word] ?? 0) + delta
    }

    const allIds: string[] = [...(stored[SEEN_KEY] ?? []), ...jobIds]
    const trimmedIds =
      allIds.length > MAX_REMEMBERED_JOBS ? allIds.slice(allIds.length - MAX_REMEMBERED_JOBS) : allIds

    await chrome.storage.local.set({
      [COUNTS_KEY]: nextCounts,
      [WORDS_KEY]: nextWords,
      [SEEN_KEY]: trimmedIds
    })
  } catch {
    // Extension reloaded mid-write. The counts are a nice-to-have, never worth surfacing
    // an error over — index.ts already tells the user to refresh.
  }
}

function scheduleFlush(): void {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS)
}

/**
 * Records that a job was hidden. Safe to call on every rescan for every card: repeat calls
 * for a job already counted do nothing. `matchedWords` only applies to 'excludedWord'.
 */
export function noteHide(jobId: string, reason: HideReason, matchedWords: string[] = []): void {
  void ensureReady().then(() => {
    if (!seenJobIds || seenJobIds.has(jobId)) return
    seenJobIds.add(jobId)

    pendingCounts[reason] = (pendingCounts[reason] ?? 0) + 1
    for (const word of matchedWords) {
      pendingWords[word] = (pendingWords[word] ?? 0) + 1
    }
    pendingJobIds.push(jobId)
    scheduleFlush()
  })
}

export async function getMetrics(): Promise<Metrics> {
  const stored = await chrome.storage.local.get([COUNTS_KEY, WORDS_KEY])
  const counts: Record<HideReason, number> = { ...EMPTY_COUNTS, ...(stored[COUNTS_KEY] ?? {}) }
  const excludedWordCounts: Record<string, number> = stored[WORDS_KEY] ?? {}
  const total = PRIMARY_REASON_ORDER.reduce((sum, reason) => sum + (counts[reason] ?? 0), 0)
  return { counts, excludedWordCounts, total }
}

export async function clearMetrics(): Promise<void> {
  seenJobIds = new Set<string>()
  pendingCounts = {}
  pendingWords = {}
  pendingJobIds = []
  await chrome.storage.local.remove([COUNTS_KEY, WORDS_KEY, SEEN_KEY])
}
