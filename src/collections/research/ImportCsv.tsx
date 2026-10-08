'use client'
import React, { useState } from 'react'

type Report = { dryRun: boolean; total: number; create: string[]; update: string[]; duplicates: string[]; errors: string[]; newProducts: string[]; created?: number; updated?: number; error?: string }

/* The monthly batch: upload a CSV, read the dry-run report, then confirm (FR-VI-05 to 07). */
export const ImportCsv: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const run = async (commit: boolean) => {
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('commit', String(commit))
    try {
      const res = await fetch('/research/vulnerability-information/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = (await res.json()) as Report
      setReport(json)
      if (!json.dryRun && !json.error) setTimeout(() => window.location.reload(), 1200)
    } catch {
      setReport({ dryRun: true, total: 0, create: [], update: [], duplicates: [], errors: ['Upload failed'], newProducts: [] })
    } finally {
      setBusy(false)
    }
  }

  const box: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', padding: '16px 20px', marginBottom: 20, borderRadius: 4, background: 'var(--theme-elevation-50)' }
  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <strong>Import a CSV batch</strong>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Columns: CVE Number, Vulnerability, Product, Severity, Date (DD-MM-YYYY). Optional: Detail, Advisory URL, Patch date, Affected software. Rows are matched on the CVE number.</div>
        </div>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Import CSV'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null) }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn--style-primary btn--size-small" disabled={!file || busy} onClick={() => run(false)}>
              Check (dry run)
            </button>
            <button type="button" className="btn btn--style-secondary btn--size-small" disabled={!file || busy || !report || !report.dryRun || report.errors.length > 0} onClick={() => run(true)}>
              Import {report?.dryRun && !report.errors.length ? `${report.create.length} new, ${report.update.length} updated` : ''}
            </button>
          </div>
          {report && (
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {report.error && <p style={{ color: 'var(--theme-error-500)' }}>{report.error}</p>}
              {!report.error && (
                <>
                  <p>
                    {report.dryRun ? 'Dry run: ' : 'Imported: '}
                    {report.total} rows · {report.create.length} new · {report.update.length} updates · {report.duplicates.length} duplicates in file · {report.errors.length} errors
                    {!report.dryRun && ` · ${report.created} created, ${report.updated} updated. Reloading…`}
                  </p>
                  {report.newProducts.length > 0 && <p>New products that will be added: {report.newProducts.join(', ')}</p>}
                  {report.duplicates.length > 0 && <p style={{ color: 'var(--theme-warning-500)' }}>{report.duplicates.join(' · ')}</p>}
                  {report.errors.length > 0 && (
                    <ul style={{ color: 'var(--theme-error-500)', margin: 0, paddingLeft: 18 }}>
                      {report.errors.slice(0, 20).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
