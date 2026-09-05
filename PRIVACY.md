# Privacy Policy

_Last updated: September 5, 2026_

ApplyW is a browser extension that runs entirely on your device. This page
describes what it does and does not do with your data.

## Nothing is transmitted

ApplyW has no backend server, no analytics, and no account. It makes no network
requests of its own, and nothing you do with it is transmitted, sold, or shared —
not with ApplyW, not with anyone else.

It does read the job listings on the page and save some of what it reads on your
device. Chrome Web Store policy asks for that to be described even when it never
leaves your browser, so the two sections below set out exactly what is read and
what is kept.

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
- The IDs of listings already counted — up to 5,000, oldest forgotten first — so
  that scrolling the same search twice doesn't count a listing twice

Job description text is never stored. It is read while the page is open, used to
detect the language and to match your keywords, and discarded when you leave.

This data is only accessible to the ApplyW extension itself, stays on your
device, and is deleted automatically if you remove the extension.

## Deleting your data

Removing the extension deletes all of it. Short of that, "Unhide all" in the
hidden jobs list and Unblock in the blocked companies list clear those entries,
and emptying your keyword and language selections clears those.

## Permissions

ApplyW requests:

- **`storage`** — to save the preferences above locally in your browser.
- **Access to `linkedin.com/jobs/search/*` pages** — to read the content of job
  listings on the page (title, company name, location, description, language)
  so it can hide, block, and filter them, and to add its Hide / Block / filter
  controls to the page. Reading the full description means observing the responses
  LinkedIn's own page already loads for the listings it shows you; ApplyW never
  requests anything itself, never alters what LinkedIn receives, and never looks at
  anything outside those job listings. This all happens locally, in your browser;
  nothing about the page or your activity on it is sent to ApplyW or any third party.

## The metrics page

The metrics page on [applyw.app](https://applyw.app/)
can ask the extension for the counts described above and display them. This is a
request from the page to the extension inside your own browser — no network
request is made, and nothing is sent to ApplyW or anyone else. It can only read
those counts, and nothing else. If the extension isn't installed, the page shows
nothing.

Only ApplyW's own site may ask. That is `applyw.app`, plus the address the site
used before it had its own domain (`applyw.chudnovskyi-v.workers.dev`), which is
listed only until everyone has updated and will be removed in a later version.
No other website can reach the extension.

## The website

[applyw.app](https://applyw.app/) has
no analytics, no tracking pixels, no advertising, and sets no cookies. It asks you
for nothing and stores nothing in your browser. Like any website it is served by a
host — Cloudflare — which keeps its own standard server logs; ApplyW neither reads
nor receives them.

## Changes to this policy

If this policy changes, the update will be reflected on this page with a
new "last updated" date above.

## Contact

Questions or concerns? [Open an issue](https://github.com/ApplyW/extension/issues).
