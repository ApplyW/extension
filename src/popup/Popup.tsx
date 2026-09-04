import { useCallback, useEffect, useState } from 'react'
import { clearHiddenJobs, getBlockedCompanies, getHiddenJobs, unblockCompany, unhideJob, type HiddenJob } from '../shared/storage'
import logoUrl from '../assets/applyw-logo.png'
import pkg from '../../package.json'

const ISSUES_URL = 'https://github.com/ApplyW/extension/issues'
// Keep in sync with manifest.config.ts's content_scripts match pattern.
const JOBS_SEARCH_URL = 'https://www.linkedin.com/jobs/search/'
// Below this many blocked companies, a search box is more clutter than it's worth.
const COMPANY_SEARCH_THRESHOLD = 5

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

export function Popup() {
  const [blockedCompanies, setBlockedCompanies] = useState<string[]>([])
  const [hiddenJobs, setHiddenJobs] = useState<HiddenJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [companyQuery, setCompanyQuery] = useState('')
  // Toggles between the main popup and the full hidden-jobs list — a second "screen"
  // inside the same popup rather than a separate window, so it stays consistent with the
  // rest of the UI without any extra window-management wiring.
  const [view, setView] = useState<'main' | 'hidden-jobs'>('main')
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

  // Leaves an empty list view stranded — back out to the main screen automatically once
  // there's nothing left to show (e.g. after undoing or clearing the last one).
  useEffect(() => {
    if (view === 'hidden-jobs' && hiddenJobs.length === 0) setView('main')
  }, [view, hiddenJobs.length])

  const handleOpenJobsSearch = (): void => {
    void chrome.tabs.create({ url: JOBS_SEARCH_URL })
  }

  const handleUnblock = (company: string): void => {
    void unblockCompany(company).then(reload)
  }

  const handleClearHiddenJobs = (): void => {
    void clearHiddenJobs().then(reload)
  }

  const handleUndoHide = (jobId: string): void => {
    void unhideJob(jobId).then(reload)
  }

  // Company names are already stored normalized/lowercased (see storage.ts), so the typed
  // query only needs its own trim + lowercase to match.
  const normalizedQuery = companyQuery.trim().toLowerCase()
  const filteredCompanies = normalizedQuery
    ? blockedCompanies.filter((company) => company.includes(normalizedQuery))
    : blockedCompanies

  const sortedHiddenJobs = [...hiddenJobs].sort((a, b) => b.hiddenAt - a.hiddenAt)

  if (view === 'hidden-jobs') {
    return (
      <div className="popup">
        <header className="header hidden-jobs-header">
          <button type="button" className="back-button" aria-label="Back" onClick={() => setView('main')}>
            ‹
          </button>
          <h2 className="hidden-jobs-title">Hidden jobs ({sortedHiddenJobs.length})</h2>
          <button type="button" className="ghost-button" onClick={handleClearHiddenJobs}>
            Clear all
          </button>
        </header>
        <ul className="hidden-job-list">
          {sortedHiddenJobs.map((job) => (
            <li key={job.jobId} className="hidden-job-item">
              <div className="hidden-job-info">
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="hidden-job-title">
                  {job.title}
                </a>
                <div className="hidden-job-meta">
                  {job.company && <strong>{job.company}</strong>}
                  {job.company && job.location ? ' | ' : ''}
                  {job.location}
                </div>
                <div className="hidden-job-time">Hidden {formatHiddenAt(job.hiddenAt)}</div>
              </div>
              <button type="button" className="ghost-button hidden-job-undo" onClick={() => handleUndoHide(job.jobId)}>
                Undo
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="popup">
      <header className="header">
        <img src={logoUrl} alt="" className="logo" width={32} height={32} />
        <div className="brand">
          <div className="brand-name">
            ApplyW
            <span className="badge">Beta</span>
          </div>
          <div className="version">v{pkg.version}</div>
        </div>
      </header>

      <section className="cta">
        {isOnJobsSearchPage ? (
          <p className="cta-status">
            <span aria-hidden="true">✓</span> Filters are active on this page
          </p>
        ) : (
          <button type="button" className="primary-button" onClick={handleOpenJobsSearch}>
            Open LinkedIn Jobs <span aria-hidden="true">↗</span>
          </button>
        )}
      </section>

      {isLoading ? (
        <p className="empty loading">Loading…</p>
      ) : (
        <div className="content">
          <section>
            <h2>Blocked companies ({blockedCompanies.length})</h2>
            {blockedCompanies.length === 0 ? (
              <p className="empty">No companies blocked yet.</p>
            ) : (
              <>
                {blockedCompanies.length > COMPANY_SEARCH_THRESHOLD && (
                  <div className="search-wrap">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search blocked companies"
                      value={companyQuery}
                      onChange={(event) => setCompanyQuery(event.target.value)}
                    />
                    {companyQuery && (
                      <button
                        type="button"
                        className="search-clear"
                        aria-label="Clear search"
                        onClick={() => setCompanyQuery('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
                {filteredCompanies.length === 0 ? (
                  <p className="empty">No blocked companies match "{companyQuery.trim()}".</p>
                ) : (
                  <ul className="company-list">
                    {filteredCompanies.map((company) => (
                      <li key={company}>
                        <span>{company}</span>
                        <button type="button" className="ghost-button" onClick={() => handleUnblock(company)}>
                          Unblock
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section>
            <h2>Hidden jobs</h2>
            {hiddenJobs.length === 0 ? (
              <p className="empty">No jobs hidden yet.</p>
            ) : (
              <button type="button" className="hidden-jobs-toggle" onClick={() => setView('hidden-jobs')}>
                <span>
                  {hiddenJobs.length} job{hiddenJobs.length === 1 ? '' : 's'} hidden
                </span>
                <span aria-hidden="true">View ›</span>
              </button>
            )}
          </section>
        </div>
      )}

      <footer className="footer">
        <a className="report-link" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          Report a problem <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  )
}
