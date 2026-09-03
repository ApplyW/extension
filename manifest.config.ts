import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

export default defineManifest({
  manifest_version: 3,
  name: 'ApplyW',
  description: "Apply Wisely: hide jobs you've seen, block companies, and filter listings by language on LinkedIn.",
  version: pkg.version,
  homepage_url: 'https://github.com/ApplyW/extension',
  icons: {
    16: 'src/assets/icons/icon16.png',
    32: 'src/assets/icons/icon32.png',
    48: 'src/assets/icons/icon48.png',
    128: 'src/assets/icons/icon128.png'
  },
  permissions: ['storage'],
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
      // Scoped to /jobs/search/ specifically, not all of /jobs/* — other LinkedIn job
      // paths (e.g. /jobs/search-job/) use a different DOM that this code doesn't handle
      // and injecting into it did more harm than good.
      matches: ['https://www.linkedin.com/jobs/search/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    },
    // MAIN world = runs in the page's own JS context, not the isolated extension one — the
    // only way to peek at LinkedIn's own network responses (chrome.webRequest can't read
    // response bodies in Chrome). Must load before LinkedIn's app code starts making
    // requests, hence document_start. See src/content/pageBridge.ts for why this exists.
    {
      matches: ['https://www.linkedin.com/jobs/search/*'],
      js: ['src/content/pageBridge.ts'],
      run_at: 'document_start',
      world: 'MAIN'
    }
  ]
})
