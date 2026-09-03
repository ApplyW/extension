import { useCallback, useEffect, useState } from 'react'
import { clearHiddenJobs, getBlockedCompanies, getHiddenJobIds, unblockCompany } from '../shared/storage'
import logoUrl from '../assets/applyw-logo.png'
import pkg from '../../package.json'

const ISSUES_URL = 'https://github.com/ApplyW/extension/issues'
// Keep in sync with manifest.config.ts's content_scripts match pattern.
const JOBS_SEARCH_URL = 'https://www.linkedin.com/jobs/search/'

function isJobsSearchUrl(url: string | undefined): boolean {
  return url?.startsWith('https://www.linkedin.com/jobs/search') ?? false
}

export function Popup() {
  const [blockedCompanies, setBlockedCompanies] = useState<string[]>([])
  const [hiddenJobCount, setHiddenJobCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  // Whether the active tab is already on LinkedIn's job search page — checked once per
  // popup open, separately from the storage-backed state above, so it doesn't need to
  // re-run after unrelated actions like unblocking a company.
  const [isOnJobsSearchPage, setIsOnJobsSearchPage] = useState(false)

  const reload = useCallback(async () => {
    const [companies, hiddenJobIds] = await Promise.all([getBlockedCompanies(), getHiddenJobIds()])
    setBlockedCompanies(Array.from(companies).sort())
    setHiddenJobCount(hiddenJobIds.size)
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

  const handleOpenJobsSearch = (): void => {
    void chrome.tabs.create({ url: JOBS_SEARCH_URL })
  }

  const handleUnblock = (company: string): void => {
    void unblockCompany(company).then(reload)
  }

  const handleClearHiddenJobs = (): void => {
    void clearHiddenJobs().then(reload)
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
              <ul className="company-list">
                {blockedCompanies.map((company) => (
                  <li key={company}>
                    <span>{company}</span>
                    <button type="button" className="ghost-button" onClick={() => handleUnblock(company)}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Hidden jobs</h2>
            <div className="hidden-jobs-row">
              <p className="count">
                {hiddenJobCount} job{hiddenJobCount === 1 ? '' : 's'} hidden
              </p>
              <button
                type="button"
                className="ghost-button"
                disabled={hiddenJobCount === 0}
                onClick={handleClearHiddenJobs}
              >
                Clear all
              </button>
            </div>
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
