# Privacy Policy

_Last updated: September 4, 2026_

ApplyW is a browser extension that runs entirely on your device. This page
describes what it does and does not do with your data.

## Data collection

ApplyW does not collect, transmit, sell, or share any personal data,
browsing history, or usage information. It has no backend server, no
analytics, and makes no network requests of its own.

## Data storage

The following is saved locally in your browser, via the standard
`chrome.storage.local` extension API, and never leaves your device:

- Job listings you've hidden — the listing's ID, title, link, company, location,
  and the time you hid it, so the extension can show you that list and let you
  unhide individual jobs
- Company names you've blocked
- Your "Hide Applied" / "Hide Viewed", language, and keyword filter preferences
- Counts of how many listings each filter has hidden for you, including how many
  times each of your excluded words matched, so the metrics page can show
  which filters are actually helping

This data is only accessible to the ApplyW extension itself, stays on your
device, and is deleted automatically if you remove the extension.

## Permissions

ApplyW requests:

- **`storage`** — to save the preferences above locally in your browser.
- **Access to `linkedin.com/jobs/search/*` pages** — to read the content of job
  listings on the page (title, company name, location, description, language)
  so it can hide, block, and filter them, and to add its Hide / Block / filter
  controls to the page. This all happens locally, in your browser; nothing about the
  page or your activity on it is sent to ApplyW or any third party.

## The metrics page

The metrics page on [applyw.chudnovskyi-v.workers.dev](https://applyw.chudnovskyi-v.workers.dev/)
can ask the extension for the counts described above and display them. This is a
request from the page to the extension inside your own browser — no network
request is made, and nothing is sent to ApplyW or anyone else. Only that one
address is allowed to ask, and it can only read those counts. If the extension
isn't installed, the page shows nothing.

## Changes to this policy

If this policy changes, the update will be reflected on this page with a
new "last updated" date above.

## Contact

Questions or concerns? [Open an issue](https://github.com/ApplyW/extension/issues).
