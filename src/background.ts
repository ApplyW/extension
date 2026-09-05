import { getMetrics } from './shared/metrics'

// The extension's first and only background worker, and it exists for exactly one reason:
// chrome.runtime.onMessageExternal is delivered here and nowhere else — not to a content
// script, not to the popup. The metrics page on the website uses it to ask for your own
// numbers.
//
// Worth being clear about what this is not: nothing is sent anywhere. The website asks the
// browser for data the browser already holds, the extension answers, and it never leaves
// the machine. The site renders nothing if the extension isn't installed.

export interface MetricsRequest {
  type: 'applyw:getMetrics'
}

// The manifest's `externally_connectable` is the gate: Chrome refuses the connection before
// this listener is ever reached, so the allowed origins live in exactly one place. An
// allowlist repeated here would only be a second thing to forget to update — which is
// precisely what would happen the day this moves to a custom domain.
chrome.runtime.onMessageExternal.addListener((message: MetricsRequest, _sender, sendResponse) => {
  if (message?.type !== 'applyw:getMetrics') return false

  void getMetrics()
    .then(sendResponse)
    .catch(() => sendResponse(null))

  // Keeps the message channel open for the async reply above.
  return true
})
