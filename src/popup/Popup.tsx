import { useCallback, useEffect, useState } from 'react'
import { clearHiddenJobs, getBlockedCompanies, getHiddenJobs, unblockCompany, unhideJob, type HiddenJob } from '../shared/storage'
import logoUrl from '../assets/applyw-logo.png'
import pkg from '../../package.json'

const ISSUES_URL = 'https://github.com/ApplyW/extension/issues'
// Keep in sync with manifest.config.ts's content_scripts match pattern.
const JOBS_SEARCH_URL = 'https://www.linkedin.com/jobs/search/'
// Below this many blocked companies, a filter box is more clutter than it's worth.
const COMPANY_SEARCH_THRESHOLD = 5
// How long "Unhide all" stays armed before falling back to its normal label.
const CONFIRM_TIMEOUT_MS = 3000

type View = 'main' | 'companies' | 'hidden'

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60]
]
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

// hiddenAt 0 marks a legacy entry hidden before this version started recording a
// timestamp (see storage.ts) — no real time to show, so a generic label instead.
function formatHiddenAt(hiddenAt: number): string {
  if (hiddenAt === 0) return 'a while ago'
  const diffMs = hiddenAt - Date.now()
  for (const [unit, unitMs] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffMs) >= unitMs) return relativeTimeFormatter.format(Math.round(diffMs / unitMs), unit)
  }
  return 'just now'
}

function isJobsSearchUrl(url: string | undefined): boolean {
  return url?.startsWith('https://www.linkedin.com/jobs/search') ?? false
}

// Drawn to the monogram's geometry rather than a stock bug glyph: straight segments only,
// flat (default `butt`) stroke ends, no curves or rounded caps anywhere.
function BugIcon() {
  return (
    <svg
      className="icon"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 5 17 9v6l-5 5-5-5V9z" />
      <path d="M12 5v15" />
      <path d="M7 10 3 7M7 13H3M7 16l-4 3M17 10l4-3M17 13h4M17 16l4 3" />
      <path d="M10 5 8 2M14 5l2-3" />
    </svg>
  )
}

export function Popup() {
  const [blockedCompanies, setBlockedCompanies] = useState<string[]>([])
  const [hiddenJobs, setHiddenJobs] = useState<HiddenJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [companyQuery, setCompanyQuery] = useState('')
  const [isConfirmingUnhideAll, setIsConfirmingUnhideAll] = useState(false)
  // Which of the three screens is showing. Both lists are drill-downs rather than one
  // inline and one drilled-in, so the two halves of the popup behave the same way.
  const [view, setView] = useState<View>('main')
  // Whether the active tab is already on LinkedIn's job search page — checked once per
  // popup open, separately from the storage-backed state above, so it doesn't need to
  // re-run after unrelated actions like unblocking a company.
  const [isOnJobsSearchPage, setIsOnJobsSearchPage] = useState(false)

  const reload = useCallback(async () => {
    const [companies, jobs] = await Promise.all([getBlockedCompanies(), getHiddenJobs()])
    setBlockedCompanies(Array.from(companies).sort())
    setHiddenJobs(jobs)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    // No "tabs" permission needed: content_scripts.matches already implies host
    // permission for this URL, which is enough for chrome.tabs.query() to populate
    // `url` on the matching tab (it's simply omitted for tabs outside our permissions,
    // which reads here as "not on the jobs search page" — a safe default either way).
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setIsOnJobsSearchPage(isJobsSearchUrl(tab?.url))
    })
  }, [])

  useEffect(() => {
    if (!isConfirmingUnhideAll) return
    const timer = setTimeout(() => setIsConfirmingUnhideAll(false), CONFIRM_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isConfirmingUnhideAll])

  const handleOpenJobsSearch = (): void => {
    void chrome.tabs.create({ url: JOBS_SEARCH_URL })
  }

  const handleUnblock = (company: string): void => {
    void unblockCompany(company).then(reload)
  }

  const handleUnhide = (jobId: string): void => {
    void unhideJob(jobId).then(reload)
  }

  // Two-press: bulk unhiding can't be undone one job at a time, so the first press only
  // arms the button and restates how many jobs it covers.
  const handleUnhideAll = (): void => {
    if (!isConfirmingUnhideAll) {
      setIsConfirmingUnhideAll(true)
      return
    }
    setIsConfirmingUnhideAll(false)
    void clearHiddenJobs().then(reload)
  }

  const goTo = (next: View): void => {
    setIsConfirmingUnhideAll(false)
    setView(next)
  }

  // Company names are already stored normalized/lowercased (see storage.ts), so the typed
  // query only needs its own trim + lowercase to match.
  const trimmedQuery = companyQuery.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()
  const filteredCompanies = normalizedQuery
    ? blockedCompanies.filter((company) => company.includes(normalizedQuery))
    : blockedCompanies

  const sortedHiddenJobs = [...hiddenJobs].sort((a, b) => b.hiddenAt - a.hiddenAt)

  if (view === 'companies') {
    return (
      <div className="screen" key="companies">
        <div className="screen-header">
          <button type="button" className="back" aria-label="Back" onClick={() => goTo('main')}>
            ‹
          </button>
          <h1 className="screen-title">
            Blocked companies {blockedCompanies.length > 0 && <span className="screen-count">{blockedCompanies.length}</span>}
          </h1>
        </div>

        {blockedCompanies.length === 0 ? (
          <p className="note">
            No companies blocked yet. Open a job on LinkedIn and press <b>Block</b> next to the company name to stop
            seeing it.
          </p>
        ) : (
          <>
            {blockedCompanies.length > COMPANY_SEARCH_THRESHOLD && (
              <div className="search">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filter by name"
                  value={companyQuery}
                  onChange={(event) => setCompanyQuery(event.target.value)}
                />
                {companyQuery && (
                  <button type="button" className="search-clear" aria-label="Clear filter" onClick={() => setCompanyQuery('')}>
                    ×
                  </button>
                )}
              </div>
            )}
            {filteredCompanies.length === 0 ? (
              <p className="note">No match for “{trimmedQuery}”.</p>
            ) : (
              <ul className="list">
                {filteredCompanies.map((company) => (
                  <li key={company} className="row">
                    <span className="tick" aria-hidden="true" />
                    <div className="row-body">
                      <span className="row-name">{company}</span>
                    </div>
                    <button type="button" className="button-quiet" onClick={() => handleUnblock(company)}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    )
  }

  if (view === 'hidden') {
    return (
      <div className="screen" key="hidden">
        <div className="screen-header">
          <button type="button" className="back" aria-label="Back" onClick={() => goTo('main')}>
            ‹
          </button>
          <h1 className="screen-title">
            Hidden jobs {hiddenJobs.length > 0 && <span className="screen-count">{hiddenJobs.length}</span>}
          </h1>
          {hiddenJobs.length > 0 && (
            <button
              type="button"
              className={`button-quiet${isConfirmingUnhideAll ? ' is-confirming' : ''}`}
              onClick={handleUnhideAll}
            >
              {isConfirmingUnhideAll ? `Unhide all ${hiddenJobs.length}?` : 'Unhide all'}
            </button>
          )}
        </div>

        {hiddenJobs.length === 0 ? (
          <p className="note">
            No jobs hidden yet. Press <b>Hide</b> on any job card to clear it out of your search results.
          </p>
        ) : (
          <ul className="list">
            {sortedHiddenJobs.map((job) => (
              <li key={job.jobId} className="row">
                <span className="tick tick-signal" aria-hidden="true" />
                <div className="row-body">
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="row-title">
                    {job.title}
                  </a>
                  <span className="row-meta">
                    {job.company && <b>{job.company}</b>}
                    {job.company && job.location ? ' | ' : ''}
                    {job.location}
                  </span>
                  <span className="row-time">Hidden {formatHiddenAt(job.hiddenAt)}</span>
                </div>
                <button type="button" className="button-quiet" onClick={() => handleUnhide(job.jobId)}>
                  Unhide
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const tallyParts: string[] = []
  if (hiddenJobs.length > 0) tallyParts.push(`${hiddenJobs.length} job${hiddenJobs.length === 1 ? '' : 's'}`)
  if (blockedCompanies.length > 0) {
    tallyParts.push(`${blockedCompanies.length} ${blockedCompanies.length === 1 ? 'company' : 'companies'}`)
  }

  return (
    <div className="screen" key="main">
      <header className="header">
        <img src={logoUrl} alt="" className="logo" width={28} height={28} />
        <span className="wordmark">ApplyW</span>
        <span className="beta">Beta</span>
        <span className="version">v{pkg.version}</span>
      </header>

      <section className="hero">
        {isOnJobsSearchPage ? (
          <p className="status">ApplyW is filtering this tab</p>
        ) : (
          <button type="button" className="button-primary" onClick={handleOpenJobsSearch}>
            Open LinkedIn Jobs
          </button>
        )}

        {!isLoading && (
          <p className="tally">
            {tallyParts.length === 0 ? (
              'Nothing cleared yet. Hide a job to get started.'
            ) : (
              <>
                Cleared{' '}
                {tallyParts.map((part, index) => (
                  <span key={part}>
                    {index > 0 && ' and '}
                    <b>{part}</b>
                  </span>
                ))}{' '}
                out of your feed.
              </>
            )}
          </p>
        )}
      </section>

      {isLoading ? (
        <p className="note">Loading…</p>
      ) : (
        <nav className="nav">
          <button type="button" className="nav-row" onClick={() => goTo('companies')}>
            <span className="tick" aria-hidden="true" />
            <span className="nav-label">Blocked companies</span>
            <span className="nav-count">{blockedCompanies.length}</span>
            <span className="nav-chevron" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="nav-row" onClick={() => goTo('hidden')}>
            <span className="tick tick-signal" aria-hidden="true" />
            <span className="nav-label">Hidden jobs</span>
            <span className="nav-count">{hiddenJobs.length}</span>
            <span className="nav-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </nav>
      )}

      <footer className="footer">
        <a className="footer-link" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          <BugIcon />
          Report a problem
        </a>
      </footer>
    </div>
  )
}
