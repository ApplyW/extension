import { useCallback, useEffect, useState } from 'react'
import { clearHiddenJobs, getBlockedCompanies, getHiddenJobIds, unblockCompany } from '../shared/storage'

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

  if (isLoading) {
    return <div className="popup">Loading…</div>
  }

  return (
    <div className="popup">
      <h1>ApplyW</h1>

      <section>
        <h2>Blocked companies ({blockedCompanies.length})</h2>
        {blockedCompanies.length === 0 ? (
          <p className="empty">No companies blocked yet.</p>
        ) : (
          <ul className="company-list">
            {blockedCompanies.map((company) => (
              <li key={company}>
                <span>{company}</span>
                <button type="button" onClick={() => handleUnblock(company)}>
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Hidden jobs</h2>
        <p>
          {hiddenJobCount} job{hiddenJobCount === 1 ? '' : 's'} hidden
        </p>
        <button type="button" disabled={hiddenJobCount === 0} onClick={handleClearHiddenJobs}>
          Clear all hidden jobs
        </button>
      </section>
    </div>
  )
}
