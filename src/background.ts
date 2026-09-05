import { getMetrics } from './shared/metrics'

// The extension's first and only background worker, and it exists for exactly one reason:
// chrome.runtime.onMessageExternal is delivered here and nowhere else — not to a content
// script, not to the popup. The metrics page on the website uses it to ask for your own
// numbers.
//
// Worth being clear about what this is not: nothing is sent anywhere. The website asks the
// browser for data the browser already holds, the extension answers, and it never leaves
// the machine. The site renders nothing if the extension isn't installed.

const ALLOWED_ORIGINS = ['https://applyw.chudnovskyi-v.workers.dev']

export interface MetricsRequest {
  type: 'applyw:getMetrics'
}

chrome.runtime.onMessageExternal.addListener((message: MetricsRequest, sender, sendResponse) => {
  // externally_connectable in the manifest already restricts who can reach this; checking
  // the origin again costs nothing and keeps the allowed caller visible in the code.
  if (!sender.origin || !ALLOWED_ORIGINS.includes(sender.origin)) return false
  if (message?.type !== 'applyw:getMetrics') return false

  void getMetrics()
    .then(sendResponse)
    .catch(() => sendResponse(null))

  // Keeps the message channel open for the async reply above.
  return true
})
