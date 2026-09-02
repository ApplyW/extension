const HIDDEN_JOBS_KEY = 'applyw:hiddenJobIds'
const BLOCKED_COMPANIES_KEY = 'applyw:blockedCompanies'
const SETTINGS_KEY = 'applyw:settings'

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

export const getHiddenJobIds = (): Promise<Set<string>> => getStoredSet(HIDDEN_JOBS_KEY)
export const hideJob = (jobId: string): Promise<void> => addToStoredSet(HIDDEN_JOBS_KEY, jobId)
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
