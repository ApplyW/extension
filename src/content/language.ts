// chrome.i18n.detectLanguage keyed by job id, so a card doesn't get re-detected on every
// scan (it's virtualized/recycled and rescanned often — see index.ts). Detection is async,
// so a card's language is unknown (never hidden by language) until detection resolves.
const languageCache = new Map<string, string | null>()
const pendingDetections = new Set<string>()

export function getCachedLanguage(jobId: string): string | null | undefined {
  return languageCache.get(jobId)
}

async function detect(text: string): Promise<string | null> {
  const result = await chrome.i18n.detectLanguage(text)
  const topLanguage = result.languages[0]?.language
  return topLanguage && topLanguage !== 'und' ? topLanguage : null
}

// Fires off detection at most once per job id and caches the result. `onDetected` is
// called once a real answer is known, so the caller (which reads the cache synchronously)
// can re-run and pick it up.
export function ensureLanguageDetected(jobId: string, text: string, onDetected: () => void): void {
  if (!text || languageCache.has(jobId) || pendingDetections.has(jobId)) return

  pendingDetections.add(jobId)
  void detect(text)
    .then((language) => {
      languageCache.set(jobId, language)
    })
    .catch((error: unknown) => {
      console.error('ApplyW: failed to detect job language', error)
      languageCache.set(jobId, null)
    })
    .finally(() => {
      pendingDetections.delete(jobId)
      onDetected()
    })
}
