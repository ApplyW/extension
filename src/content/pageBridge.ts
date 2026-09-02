// Runs in the page's own JS context (a MAIN-world content script — see manifest.config.ts),
// not our regular ISOLATED-world one. This is the only place in Chrome that can see the
// body of a request LinkedIn's own app code makes: chrome.webRequest cannot read response
// bodies at all in Chrome (unlike Firefox's browser.webRequest.filterResponseData, which
// linkedin-language-filter — https://github.com/M1h4n1k/linkedin-language-filter — used;
// that API has no Chrome equivalent). MAIN-world scripts have no access to chrome.* APIs
// and don't share JS state/globals with our real (ISOLATED-world) content script — only the
// DOM is shared — so accumulated descriptions are written into a hidden DOM element
// (jobDescriptions.ts reads it) rather than only ever sent as a CustomEvent payload: this
// script runs at document_start and can see network responses before the real content
// script (document_idle) even exists to attach a listener — e.g. LinkedIn auto-opens the
// first job's detail pane on page load, firing its description request immediately. A
// CustomEvent fired before anything is listening is simply lost; DOM state isn't.
//
// LinkedIn's job descriptions come back on two GraphQL endpoints, and are shaped
// differently on each — both facts taken directly from that extension's source, since
// neither is documented:
// - "default" (URL contains JOB_DESCRIPTION_CARD): fired when a single card is opened;
//   the posting is unconditionally `included[0]`, description at `descriptionText.text`.
// - "prefetch" (URL contains jobCardPrefetchQuery): fired for several postings at once;
//   each is an `included` entry with `$type` "com.linkedin.voyager.dash.jobs.JobPosting",
//   description at `description.text`.
// We patch fetch/XHR to *peek* at responses via .clone()/a load listener — never touching
// what the page actually receives — so LinkedIn's own request handling is unaffected even
// if our parsing below is wrong or throws.

const EVENT_NAME = 'applyw:job-descriptions'
const BUFFER_ELEMENT_ID = 'applyw-job-descriptions-buffer'
const JOB_POSTING_TYPE = 'com.linkedin.voyager.dash.jobs.JobPosting'

type ResponseKind = 'default' | 'prefetch'

interface JobDescription {
  jobId: string
  description: string
}

const allDescriptions = new Map<string, string>()

function matchResponseKind(url: string): ResponseKind | null {
  if (!url.includes('/voyager/api/graphql')) return null
  if (url.includes('JOB_DESCRIPTION_CARD')) return 'default'
  if (url.includes('jobCardPrefetchQuery')) return 'prefetch'
  return null
}

// Matches the reference implementation's `entityUrn.split(":")[3]` — e.g.
// "urn:li:fsd_jobPosting:4452330676" — falling back to the first long digit run only if
// that segment isn't purely numeric, in case a urn shape shows up that doesn't fit.
function extractJobId(entityUrn: string): string | null {
  const segment = entityUrn.split(':')[3]
  if (segment && /^\d+$/.test(segment)) return segment
  const fallback = entityUrn.match(/\d{6,}/)
  return fallback ? fallback[0] : null
}

function extractDescriptions(payload: unknown, kind: ResponseKind): JobDescription[] {
  const included = (payload as { included?: unknown[] } | null)?.included
  if (!Array.isArray(included)) return []

  type RawPosting = { entityUrn?: string; $type?: string; description?: { text?: string }; descriptionText?: { text?: string } }
  const candidates: RawPosting[] =
    kind === 'prefetch'
      ? (included as RawPosting[]).filter((item) => item?.$type === JOB_POSTING_TYPE)
      : (included as RawPosting[]).slice(0, 1)

  const results: JobDescription[] = []
  for (const item of candidates) {
    const description = kind === 'prefetch' ? item.description?.text : item.descriptionText?.text
    if (!item.entityUrn || !description) continue

    const jobId = extractJobId(item.entityUrn)
    if (jobId) results.push({ jobId, description })
  }
  return results
}

// Writes the full accumulated set into a hidden <script type="application/json"> "data
// island" (browsers never execute a script tag with a non-JS type, so this is inert) and
// fires a payload-less CustomEvent as a "go re-read it" signal — the DOM write is what
// actually survives regardless of when the other side starts listening.
function publishDescriptions(newOnes: JobDescription[]): void {
  if (newOnes.length === 0) return
  for (const { jobId, description } of newOnes) allDescriptions.set(jobId, description)

  let bufferEl = document.getElementById(BUFFER_ELEMENT_ID) as HTMLScriptElement | null
  if (!bufferEl) {
    bufferEl = document.createElement('script')
    bufferEl.id = BUFFER_ELEMENT_ID
    bufferEl.type = 'application/json'
    bufferEl.hidden = true
    document.documentElement.appendChild(bufferEl)
  }
  bufferEl.textContent = JSON.stringify(Array.from(allDescriptions.entries()))
  document.dispatchEvent(new CustomEvent(EVENT_NAME))
}

function handleResponseText(text: string, kind: ResponseKind): void {
  try {
    const descriptions = extractDescriptions(JSON.parse(text), kind)
    console.log(`ApplyW: ${kind} response yielded ${descriptions.length} job description(s)`)
    publishDescriptions(descriptions)
  } catch (error) {
    // Not JSON, or not shaped like we expect — ignore. Never let this reach the caller of
    // fetch/XHR; the page's own handling of its own request must stay untouched.
    console.log('ApplyW: failed to parse a job-description response', error)
  }
}

// RequestInfo can be a string, a URL, or a Request — LinkedIn's own code decides which, so
// all three are handled rather than assuming a string.
function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

const originalFetch = window.fetch
window.fetch = async function applywFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  const response = await originalFetch.apply(this, args)
  try {
    const kind = matchResponseKind(requestUrl(args[0]))
    if (kind) {
      response
        .clone()
        .text()
        .then((text) => handleResponseText(text, kind))
        .catch(() => {})
    }
  } catch {
    // Never let a bug here affect the page's own fetch result.
  }
  return response
}

// responseType isn't known yet at open() time — the page sets it between open() and
// send() — so it has to be checked inside the load handler, not here. Reading
// .responseText when responseType is anything but '' or 'text' throws InvalidStateError
// (this is what was actually breaking every XHR-based response, silently, until this was
// caught via a real console error), so 'blob' is read via Blob.text() instead; anything
// else (arraybuffer, json, document) is skipped rather than guessed at.
function readXhrBody(xhr: XMLHttpRequest, kind: ResponseKind): void {
  if (xhr.responseType === '' || xhr.responseType === 'text') {
    handleResponseText(xhr.responseText, kind)
  } else if (xhr.responseType === 'blob' && xhr.response instanceof Blob) {
    xhr.response
      .text()
      .then((text) => handleResponseText(text, kind))
      .catch(() => {})
  }
}

const originalXhrOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function applywXhrOpen(
  this: XMLHttpRequest,
  ...args: Parameters<typeof XMLHttpRequest.prototype.open>
): void {
  try {
    const url = args[1]
    const kind = matchResponseKind(typeof url === 'string' ? url : url.toString())
    if (kind)
      this.addEventListener('load', () => {
        try {
          readXhrBody(this, kind)
        } catch {
          // Never let a bug here surface as an uncaught error on the page.
        }
      })
  } catch {
    // Never let a bug here affect the page's own XHR.
  }
  originalXhrOpen.apply(this, args)
}
