import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }
// Shared with the popup, which links to the same site — see src/shared/site.ts.
import { SITE_ORIGINS } from './src/shared/site'

export default defineManifest(({ mode }) => ({
  manifest_version: 3,
  // Both of these are what the Chrome Web Store shows as the listing name and summary,
  // so they are search copy as much as identity: the name is the heaviest-weighted field
  // in store search and names the features people actually search for, not just the brand.
  // Hard limits are 75 characters for the name and 132 for the description.
  name: 'ApplyW - LinkedIn Job Language Filter',
  description: "Clean up LinkedIn Jobs: hide jobs you've viewed or applied to, filter by keyword and language, and block companies.",
  version: pkg.version,
  homepage_url: 'https://github.com/ApplyW/extension',
  icons: {
    16: 'src/assets/icons/icon16.png',
    32: 'src/assets/icons/icon32.png',
    48: 'src/assets/icons/icon48.png',
    128: 'src/assets/icons/icon128.png'
  },
  permissions: ['storage'],
  // Exists only so chrome.runtime.onMessageExternal can be received — see src/background.ts.
  background: {
    service_worker: 'src/background.ts',
    type: 'module'
  },
  // Lets the metrics page on the website ask the extension for the user's own counts.
  // Only these origins can reach the extension, and only to read numbers already stored
  // locally — no network request is involved on either side. The dev server is added in
  // development builds only: a published extension that answers anything on localhost
  // would let any local server read your counts.
  externally_connectable: {
    matches: [
      ...SITE_ORIGINS.map((origin) => `${origin}/*`),
      ...(mode === 'development' ? ['http://localhost:5173/*'] : [])
    ]
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'ApplyW',
    default_icon: {
      16: 'src/assets/icons/icon16.png',
      32: 'src/assets/icons/icon32.png',
      48: 'src/assets/icons/icon48.png',
      128: 'src/assets/icons/icon128.png'
    }
  },
  content_scripts: [
    {
      // Matches all of linkedin.com, not just the two job-search paths this actually does
      // anything on — LinkedIn is a single-page app, so reaching /jobs/search-results/ by
      // clicking a link from elsewhere (the normal way people get there) is a client-side
      // route change, not a real page load, and Chrome only injects content scripts on real
      // navigations. Being present from whichever page the user actually started on is the
      // only way to notice that route change at all — see index.ts, which does the real
      // work only while location.pathname actually matches one of those two paths (other
      // LinkedIn job paths, e.g. /jobs/search-job/, use a different DOM this code doesn't
      // handle, so those stay excluded even though the match itself is now broad).
      matches: ['https://www.linkedin.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    },
    // MAIN world = runs in the page's own JS context, not the isolated extension one — the
    // only way to peek at LinkedIn's own network responses (chrome.webRequest can't read
    // response bodies in Chrome). Must load before LinkedIn's app code starts making
    // requests, hence document_start. See src/content/pageBridge.ts for why this exists.
    // Matches all of linkedin.com for the same SPA-navigation reason as index.ts above —
    // pageBridge.ts already self-gates by checking each request's own URL, so widening its
    // match needed no other change.
    {
      matches: ['https://www.linkedin.com/*'],
      js: ['src/content/pageBridge.ts'],
      run_at: 'document_start',
      world: 'MAIN'
    },
    // Matches all of linkedin.com, not just /jobs/ — LinkedIn is a single-page app, so
    // reaching /jobs/ by clicking a link from, say, a profile page is a client-side route
    // change, not a real page load, and Chrome only re-evaluates content_scripts.matches on
    // real navigations. This has to already be running before the user gets to /jobs/ to
    // notice the route change at all — see goToSearchButton.ts, which does nothing on any
    // page but that exact one.
    {
      matches: ['https://www.linkedin.com/*'],
      js: ['src/content/goToSearchButton.ts'],
      run_at: 'document_idle'
    }
  ]
}))
