# Chrome Web Store listing

The **name** and **summary** shown on the store come straight from
`manifest.config.ts` (`name` and `description`) — editing them here does nothing,
edit the manifest. The **detailed description** below is dashboard-only and has no
home in the code, which is why it lives here.

Limits, all silently enforced: name **75** characters, summary **132**.

## Why the name is long

Store search weights the name more heavily than any other field, and an exact
keyword match in the name outranks the same keyword in a description. Across the
ten LinkedIn job-filter extensions on the store, every one above 2,000 users names
the *action* in its title ("Hide Applied", "Hide Promoted", "Companies",
"Keywords"); every brand-only title sits under 1,000. So the name carries the
three phrases people actually search for, not just "ApplyW".

`LinkedIn Job Filter` alone is a losing fight — a competitor is literally named
that, and gets the exact match. The clauses after the colon are the point: nothing
else on the store pairs "block companies" with LinkedIn in its title.

Keep it readable as a sentence. A comma-separated pile of keywords trips the
[Keyword Spam policy](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements/).

## Detailed description

The live text, as pasted into the dashboard. First ~100 words carry the search
weight, so the target phrases stay in the opening paragraph. Keep the store copy
honest about what works on the page LinkedIn actually serves: as of 1.0.1 that's
`/jobs/search-results/`, where the Language filter can't run and the Keyword
filter has no controls yet.

```
ApplyW — Apply Wisely — is a free LinkedIn job search filter for Chrome. Hide job postings you've already seen or applied to, and block companies you'll never apply to. It all happens on the search results page, in your own browser: no account, no server, nothing sent anywhere.

❗Works on LinkedIn's job search results page: linkedin.com/jobs/search-results❗
❗LinkedIn has changed its job search site. The keyword and language filters are temporarily unavailable on the new page — a fix is in progress❗

WHY

LinkedIn's job search gets noisy fast. The same postings resurface after you've read them or applied to them. Listings show up in languages you don't speak. A company you've ruled out keeps appearing under five different job titles. LinkedIn gives you no way to make any of it stop. ApplyW does, in one click per listing, and it stays that way across reloads.

WHAT IT DOES

• Hide any job with one click — it stays hidden across reloads and searches
• Block a company — click Block on any job card, and every posting from that company disappears, immediately and from then on
• Hide Applied / Hide Viewed — two toggles sitting right next to LinkedIn's own filters (Date Posted, Experience level, ...)
• Hidden jobs list — everything you've hidden, with its title, company, location and when you hid it. Bring back any single one, or all of them at once
• Blocked companies list — everything you've blocked, unblockable in one click, with a search box once the list gets long
• Metrics — see which of your filters is actually doing the work, ranked side by side, with a per-word breakdown of how many listings each excluded word caught
• Keyword filter (coming back soon) — show only jobs containing words you choose ("Java", "Remote"), or hide the ones containing words you don't ("Junior", "Unpaid"). Whole-word and case-insensitive, so "Java" never matches "JavaScript". Words you already saved still hide matching job titles
• Language filter (coming back soon) — see only jobs written in the languages you actually read, detected locally from the real job description

Every filter re-applies automatically as you scroll and as LinkedIn loads more results. Set it up once; it keeps working.

NEW IN 1.0.1

• Hide Applied / Hide Viewed fixed on LinkedIn's new job search page — the toggles were repeating after every one of LinkedIn's filters. They now appear once, right before "All filters"

PRIVACY

ApplyW has no backend, no analytics, no tracking, and no sign-up. It makes no network requests of its own. Your hidden jobs, blocked companies and filter settings are saved in your browser's own extension storage and are deleted when you remove the extension. Job description text is never stored — it's read while the page is open and discarded when you leave.

Beyond reading the LinkedIn job pages it runs on, it asks for exactly one permission: storage.

Full policy: https://github.com/ApplyW/extension/blob/main/PRIVACY.md

OPEN SOURCE

ApplyW is MIT-licensed and the whole extension is readable on GitHub — including everything above, so you don't have to take the privacy claims on trust.

Website: https://applyw.app
Source: https://github.com/ApplyW/extension
Bugs and feature requests: https://github.com/ApplyW/extension/issues

Free, open source, actively developed. 
Not affiliated with or endorsed by LinkedIn.
```

## Keywords

- **In the name, contested head-on** — linkedin job filter, hide applied jobs,
  hide viewed jobs, block companies
- **In the first 100 words** — linkedin job search results, filter linkedin jobs,
  clean up linkedin jobs, keyword filter
- **Uncontested, worth defending** — linkedin job language filter, filter jobs by
  language, english job listings. One rival, 36 users. This is the only phrase
  ApplyW can rank first on today
- **Not ours yet** — hide promoted jobs, hide reposted jobs, early applicant. The
  highest-volume phrases in the niche and the clearest feature gap; don't put them
  in copy before the features exist

## Outstanding listing changes

- **Category → Social Networking.** Currently Tools, the most saturated category;
  the 20,000-user leader and two other 2,000+ extensions are in Social Networking.
- **Verify the `applyw.app` developer domain** in the dashboard — a documented
  ranking boost, and free since the domain is already owned.

Neither is in this repo. Both are dashboard settings.

At four users, though, none of the above outweighs retention: store search reads
weekly active users and install-per-view conversion, so the first twenty users who
keep the extension move ranking further than any wording will.
