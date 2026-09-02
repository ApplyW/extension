import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

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
    }
  ]
})
