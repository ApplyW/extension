import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

export default defineManifest({
  manifest_version: 3,
  name: 'ApplyW',
  description: 'Declutters LinkedIn job listings: hides seen/applied jobs, filters by language, blocks companies.',
  version: pkg.version,
  permissions: ['storage'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'ApplyW'
  },
  content_scripts: [
    {
      matches: ['https://www.linkedin.com/jobs/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    },
    // MAIN world = runs in the page's own JS context, not the isolated extension one — the
    // only way to peek at LinkedIn's own network responses (chrome.webRequest can't read
    // response bodies in Chrome). Must load before LinkedIn's app code starts making
    // requests, hence document_start. See src/content/pageBridge.ts for why this exists.
    {
      matches: ['https://www.linkedin.com/jobs/*'],
      js: ['src/content/pageBridge.ts'],
      run_at: 'document_start',
      world: 'MAIN'
    }
  ]
})
