// Deep import (not the bare "languagedetect" specifier) — the package's package.json main
// field is "index" with no extension, which Rolldown resolves ambiguously and leaves as a
// runtime dynamic import CRXJS then mistakes for a chunk needing a web_accessible_resources
// entry, failing the build with "Could not load manifest asset \"languagedetect\"". Pointing
// at the real file sidesteps that; its type declarations (index.d.ts) still resolve since
// TypeScript looks for a co-located .d.ts next to any .js file it imports.
import LanguageDetect from 'languagedetect/index.js'

// Same detection engine used by linkedin-language-filter
// (github.com/M1h4n1k/linkedin-language-filter) — a working reference for this exact
// feature — instead of chrome.i18n.detectLanguage, which was giving worse results in
// practice. N-gram based, entirely local/offline. One shared instance: building it isn't
// free and it holds no per-call state. 'iso2' matches the 2-letter codes languageFilter.ts
// already uses.
const detector = new LanguageDetect()
detector.setLanguageType('iso2')

// Cached per job id. Only ever detected from the full job description (see
// jobDescriptions.ts) — a short title is not reliable input for this, and detecting one
// twice (once from the title as a guess, then again once a description arrives) produced
// confusing, often-wrong intermediate results in practice. So a job simply has no
// detected language — no badge, never filtered — until its description actually arrives.
const languageCache = new Map<string, string | null>()

export function getCachedLanguage(jobId: string): string | null | undefined {
  return languageCache.get(jobId)
}

function detect(text: string): string | null {
  const [topMatch] = detector.detect(text, 1)
  return topMatch ? topMatch[0] : null
}

// Detection is synchronous (pure local computation, no network/extension API round-trip)
// and runs at most once per job id — the result is cached and just returned after that.
export function ensureLanguageDetected(jobId: string, description: string): string | null {
  const cached = languageCache.get(jobId)
  if (cached !== undefined) return cached

  const language = detect(description)
  languageCache.set(jobId, language)
  console.log(`ApplyW: detected "${language ?? 'unknown'}" for job ${jobId} (${description.length} chars)`)
  return language
}
