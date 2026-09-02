// Populated by pageBridge.ts, a MAIN-world script that patches fetch/XHR to peek at
// LinkedIn's own network responses — see that file for why this needs a separate
// MAIN-world script at all. Reads the accumulated set from a hidden DOM element pageBridge
// writes it into (not just the CustomEvent's payload): pageBridge runs at document_start
// and can see responses before this script (document_idle) even exists to listen, so a
// description arriving that early would otherwise be lost the moment it's dispatched.
// Reading persistent DOM state instead means it's caught regardless of load-order timing.
const EVENT_NAME = 'applyw:job-descriptions'
const BUFFER_ELEMENT_ID = 'applyw-job-descriptions-buffer'

const descriptionsByJobId = new Map<string, string>()

export function getJobDescription(jobId: string): string | undefined {
  return descriptionsByJobId.get(jobId)
}

function readBuffer(): void {
  const text = document.getElementById(BUFFER_ELEMENT_ID)?.textContent
  if (!text) return

  try {
    const entries = JSON.parse(text) as [string, string][]
    for (const [jobId, description] of entries) descriptionsByJobId.set(jobId, description)
    console.log(`ApplyW: now have descriptions for ${descriptionsByJobId.size} job(s)`)
  } catch (error) {
    console.log('ApplyW: failed to read the job-descriptions buffer', error)
  }
}

export function listenForJobDescriptions(onReceived: () => void): void {
  // Catches anything pageBridge.ts already wrote before this ran.
  readBuffer()
  if (descriptionsByJobId.size > 0) onReceived()

  document.addEventListener(EVENT_NAME, () => {
    readBuffer()
    onReceived()
  })
}
