const HIDDEN_JOBS_KEY = 'applyw:hiddenJobIds'
const BLOCKED_COMPANIES_KEY = 'applyw:blockedCompanies'
const SETTINGS_KEY = 'applyw:settings'
const SELECTED_LANGUAGES_KEY = 'applyw:selectedLanguages'
const MUST_INCLUDE_WORDS_KEY = 'applyw:mustIncludeWords'
const MUST_EXCLUDE_WORDS_KEY = 'applyw:mustExcludeWords'

async function getStoredSet(key: string): Promise<Set<string>> {
  const result = await chrome.storage.local.get(key)
  const values: string[] = result[key] ?? []
  return new Set(values)
}

async function addToStoredSet(key: string, value: string): Promise<void> {
  const values = await getStoredSet(key)
  values.add(value)
  await chrome.storage.local.set({ [key]: Array.from(values) })
}

async function removeFromStoredSet(key: string, value: string): Promise<void> {
  const values = await getStoredSet(key)
  values.delete(value)
  await chrome.storage.local.set({ [key]: Array.from(values) })
}

export interface HiddenJob {
  jobId: string
  title: string
  url: string
  company: string
  location: string
  hiddenAt: number
}

// Pre-0.1.4 versions stored this key as a bare array of job id strings. Read defensively so
// an upgrading user's already-hidden jobs stay hidden instead of silently reappearing —
// legacy entries get placeholder details since the original title/company/location was
// never saved, and hiddenAt 0 so they sort as the oldest entries once the popup lists them.
function normalizeHiddenJob(value: string | HiddenJob): HiddenJob {
  if (typeof value === 'string') {
    return { jobId: value, title: 'Job', url: `https://www.linkedin.com/jobs/view/${value}/`, company: '', location: '', hiddenAt: 0 }
  }
  return value
}

export async function getHiddenJobs(): Promise<HiddenJob[]> {
  const result = await chrome.storage.local.get(HIDDEN_JOBS_KEY)
  const stored: (string | HiddenJob)[] = result[HIDDEN_JOBS_KEY] ?? []
  return stored.map(normalizeHiddenJob)
}

export async function getHiddenJobIds(): Promise<Set<string>> {
  const jobs = await getHiddenJobs()
  return new Set(jobs.map((job) => job.jobId))
}

export async function hideJob(job: HiddenJob): Promise<void> {
  const jobs = await getHiddenJobs()
  if (jobs.some((existing) => existing.jobId === job.jobId)) return
  jobs.push(job)
  await chrome.storage.local.set({ [HIDDEN_JOBS_KEY]: jobs })
}

export async function unhideJob(jobId: string): Promise<void> {
  const jobs = await getHiddenJobs()
  await chrome.storage.local.set({ [HIDDEN_JOBS_KEY]: jobs.filter((job) => job.jobId !== jobId) })
}

export const clearHiddenJobs = (): Promise<void> => chrome.storage.local.remove(HIDDEN_JOBS_KEY)

export const getBlockedCompanies = (): Promise<Set<string>> => getStoredSet(BLOCKED_COMPANIES_KEY)
export const blockCompany = (normalizedCompanyName: string): Promise<void> =>
  addToStoredSet(BLOCKED_COMPANIES_KEY, normalizedCompanyName)
export const unblockCompany = (normalizedCompanyName: string): Promise<void> =>
  removeFromStoredSet(BLOCKED_COMPANIES_KEY, normalizedCompanyName)

export interface Settings {
  hideApplied: boolean
  hideViewed: boolean
}

const DEFAULT_SETTINGS: Settings = { hideApplied: false, hideViewed: false }

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<Settings> | undefined) }
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const settings = await getSettings()
  settings[key] = value
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

// The set of languages to show (empty = no language filtering, show everything). Unlike
// hidden jobs/blocked companies, the whole selection is replaced at once (the filter
// dropdown commits its staged checkboxes together via Apply), not added/removed one at a time.
export async function getSelectedLanguages(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(SELECTED_LANGUAGES_KEY)
  const codes: string[] = result[SELECTED_LANGUAGES_KEY] ?? []
  return new Set(codes)
}

export async function setSelectedLanguages(languageCodes: Set<string>): Promise<void> {
  await chrome.storage.local.set({ [SELECTED_LANGUAGES_KEY]: Array.from(languageCodes) })
}

// Words a job's description must contain (empty = no filtering). Same whole-selection-
// replaced-via-Apply pattern as selected languages. Stored normalized (trimmed, lowercased)
// for matching — same known rough edge as blocked company names above.
export async function getMustIncludeWords(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(MUST_INCLUDE_WORDS_KEY)
  const words: string[] = result[MUST_INCLUDE_WORDS_KEY] ?? []
  return new Set(words)
}

export async function setMustIncludeWords(words: Set<string>): Promise<void> {
  await chrome.storage.local.set({ [MUST_INCLUDE_WORDS_KEY]: Array.from(words) })
}

// Words that hide a job if its description contains any of them.
export async function getMustExcludeWords(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(MUST_EXCLUDE_WORDS_KEY)
  const words: string[] = result[MUST_EXCLUDE_WORDS_KEY] ?? []
  return new Set(words)
}

export async function setMustExcludeWords(words: Set<string>): Promise<void> {
  await chrome.storage.local.set({ [MUST_EXCLUDE_WORDS_KEY]: Array.from(words) })
}
