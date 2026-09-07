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

First ~100 words carry the search weight, so every target phrase appears there.
"Free" is repeated because the two largest rivals charge for keyword and company
blocking; the MIT licence is called out because the best-rated competitor competes
on exactly that.

```
Clean up LinkedIn Jobs. ApplyW is a free LinkedIn job filter that hides jobs
you've already viewed or applied to, lets you block companies you never want to
see again, and filters listings by keyword and by language — all locally, in your
browser.

FILTERS
• Hide applied jobs — listings you've already applied to disappear from LinkedIn
  job search results
• Hide viewed jobs — stop re-reading the same postings on every search
• Block a company — one click, and every listing from that employer is gone,
  permanently
• Keyword filter — require or exclude words ("Java", "Junior") in a job's title
  or description
• Language filter — see only jobs written in languages you actually read,
  detected from the real job description, not guessed from the title
• Hide any single job — one click, and it stays hidden across reloads

WHAT YOU HID, AND WHY
• Hidden jobs list — every job you hid, with title, company, location and when.
  Bring back one, or all of them
• Blocked companies list — unblock in one click, searchable once it grows
• Metrics — see exactly which of your filters is saving you the most time,
  ranked, with a count for every excluded word

PRIVATE BY DESIGN
No account. No server. No analytics. No tracking. ApplyW makes no network requests
of its own and asks for a single permission (storage). Your hidden jobs, blocked
companies and filter settings are saved in your own browser and never sent
anywhere. Open source under the MIT license.

Works on both of LinkedIn's job search pages.

Free, no sign-up, no paid tier.
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
