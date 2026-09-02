const HIDDEN_JOBS_KEY = 'applyw:hiddenJobIds'

export async function getHiddenJobIds(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(HIDDEN_JOBS_KEY)
  const ids: string[] = result[HIDDEN_JOBS_KEY] ?? []
  return new Set(ids)
}

export async function hideJob(jobId: string): Promise<void> {
  const ids = await getHiddenJobIds()
  ids.add(jobId)
  await chrome.storage.local.set({ [HIDDEN_JOBS_KEY]: Array.from(ids) })
}
