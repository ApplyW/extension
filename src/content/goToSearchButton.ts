// Injected on all of linkedin.com (see manifest.config.ts), not just /jobs/ — LinkedIn is
// a single-page app, so reaching /jobs/ by clicking a link from, say, a profile page is a
// client-side route change, not a real page load, and Chrome only re-evaluates
// content_scripts.matches on real navigations. The only way to show a button "whenever the
// user ends up on /jobs/, no matter where they started" is to already be running before
// they get there and watch the SPA's own route changes ourselves. This file deliberately
// does nothing at all outside the exact /jobs/ path (see isTargetPage) — the wider match is
// only so it's present early enough to notice.

const BUTTON_ID = 'applyw-go-to-search-button'
const SEARCH_URL = 'https://www.linkedin.com/jobs/search/'
const SIGNAL = '#1a7bff'
// The mark's one repeated motif — a small skewed tick — reused here at button scale
// rather than pulled in from popup.css, which isn't loaded on this page.
const SHEAR = 'skewX(-18deg)'

// Exact path only, not nested pages like /jobs/collections/ or either search page —
// LinkedIn's Jobs home has no native link to /jobs/search/ at all, so this is the one way
// there.
function isTargetPage(): boolean {
  return location.pathname === '/jobs/'
}

function createTick(): HTMLSpanElement {
  const tick = document.createElement('span')
  tick.setAttribute('aria-hidden', 'true')
  Object.assign(tick.style, {
    display: 'inline-block',
    width: '3px',
    height: '13px',
    background: '#ffffff',
    transform: SHEAR,
    flex: '0 0 auto'
  })
  return tick
}

function createButton(): HTMLAnchorElement {
  const link = document.createElement('a')
  link.id = BUTTON_ID
  link.href = SEARCH_URL
  link.title = 'Open the LinkedIn job search page ApplyW filters'
  Object.assign(link.style, {
    position: 'fixed',
    left: '24px',
    bottom: '24px',
    zIndex: '9999',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 18px 11px 14px',
    font: '600 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#ffffff',
    background: SIGNAL,
    textDecoration: 'none',
    border: 'none',
    borderRadius: '2px',
    boxShadow: '0 2px 12px rgba(15, 23, 42, 0.3)'
  })
  link.appendChild(createTick())
  link.appendChild(document.createTextNode('Open filtered job search'))
  return link
}

// Adds or removes the button to match the current route — called on load, on every SPA
// route change (see below), and from the MutationObserver in case LinkedIn's own re-render
// happens to wipe the button while still on /jobs/.
function syncButton(): void {
  const existing = document.getElementById(BUTTON_ID)
  if (!isTargetPage()) {
    existing?.remove()
    return
  }
  if (!existing) document.body.appendChild(createButton())
}

// LinkedIn's router navigates via history.pushState/replaceState, not full page loads, so
// this patches both (plus popstate, for back/forward) to notice a route change — Chrome
// never re-runs content scripts for a same-document SPA navigation, so nothing else would
// tell this script the URL changed.
function notifyLocationChange(): void {
  window.dispatchEvent(new Event('applyw:locationchange'))
}

const originalPushState = history.pushState.bind(history)
history.pushState = (...args: Parameters<History['pushState']>): void => {
  originalPushState(...args)
  notifyLocationChange()
}

const originalReplaceState = history.replaceState.bind(history)
history.replaceState = (...args: Parameters<History['replaceState']>): void => {
  originalReplaceState(...args)
  notifyLocationChange()
}

window.addEventListener('popstate', notifyLocationChange)
window.addEventListener('applyw:locationchange', syncButton)

syncButton()
new MutationObserver(syncButton).observe(document.body, { childList: true })
