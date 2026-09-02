import { useCallback, useEffect, useState } from 'react'
import { clearHiddenJobs, getBlockedCompanies, getHiddenJobIds, unblockCompany } from '../shared/storage'
import logoUrl from '../assets/applyw-logo.png'
import pkg from '../../package.json'

const ISSUES_URL = 'https://github.com/ApplyW/extension/issues'

export function Popup() {
  const [blockedCompanies, setBlockedCompanies] = useState<string[]>([])
  const [hiddenJobCount, setHiddenJobCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    const [companies, hiddenJobIds] = await Promise.all([getBlockedCompanies(), getHiddenJobIds()])
    setBlockedCompanies(Array.from(companies).sort())
    setHiddenJobCount(hiddenJobIds.size)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

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
