import type { Metadata } from 'next'
import Link from 'next/link'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'

import { ResearchBar } from '@/components/research/Bar'
import { CopyButton } from '@/components/research/Copy.client'
import { Hash, Prev } from '@/components/research/Parts'
import { RemovalSteps, ThreatLog } from '@/components/research/ThreatLog'
import { getThreat } from '@/lib/research/data'
import { dmy } from '@/lib/research/format'
import { getServerSideURL } from '@/utilities/getURL'

type Args = { params: Promise<{ slug: string }> }
const OS: Record<string, string> = { windows: 'Windows', android: 'Android', linux: 'Linux', macos: 'macOS' }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const t = await getThreat((await params).slug)
  if (!t) return { title: 'Detection not found' }
  return { title: `${t.detectionName} | Top Threats | K7 Labs`, description: `K7 detection ${t.detectionName}: file details, behaviour and removal instructions.`, alternates: { canonical: `${getServerSideURL()}/research/top-threats/${t.slug}` } }
}

/* FR-TT-02, FR-TT-04: the detection detail at a stable URL; retired entries still open here. */
export default async function ThreatPage({ params }: Args) {
  const { isEnabled: draft } = await draftMode()
  const t = await getThreat((await params).slug, draft)
  if (!t) notFound()
  const m = t.detectionName.match(/^(.*?)\s*\((.*)\)\s*$/)
  return (
    <>
      <ResearchBar active="top-threats" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Top Threats', href: '/research/top-threats' }, { label: t.detectionName }]} section />
      <main id="main">
        <section className="sheet uhead g-panel">
          <Link className="backlink label" href="/research/top-threats">
            <span aria-hidden="true">←</span>All top threats
          </Link>
          <h1 style={{ margin: 0 }}>
            <span className="id-display">
              {m ? (
                <>
                  {m[1]} <span className="pre">({m[2]!.trim()})</span>
                </>
              ) : (
                t.detectionName
              )}
            </span>
          </h1>
          {t.retired && (
            <p className="label" style={{ marginTop: 16, color: 'var(--acc)' }}>
              Retired from the Top Threats list
            </p>
          )}
          <div className="spec-strip">
            <div>
              <span className="label muted">Prevalence</span>
              <span>
                <Prev value={t.prevalence} />
              </span>
            </div>
            <div>
              <span className="label muted">Affected OS</span>
              <span className="v">{(t.affectedOs ?? []).map((o) => OS[o] ?? o).join(', ')}</span>
            </div>
            {t.firstSeen && (
              <div>
                <span className="label muted">First seen</span>
                <span className="v mono">{dmy(t.firstSeen)}</span>
              </div>
            )}
            <div>
              <span className="label muted">Last seen</span>
              <span className="v mono">{dmy(t.lastSeen)}</span>
            </div>
            <div>
              <span className="label muted">AV definition version</span>
              <span className="v mono">{t.avDefinitionVersion}</span>
            </div>
          </div>
        </section>
        <section className="sheet g-paper" aria-label="Detection detail">
          <div className="detail-grid">
            <div>
              {t.behaviourDetails && (
                <div className="block">
                  <h2>Behaviour</h2>
                  <p>Observed when the sample runs.</p>
                  <ThreatLog text={t.behaviourDetails} />
                </div>
              )}
              {t.removalInstructions && (
                <div className="block">
                  <h2>Removal instructions</h2>
                  <RemovalSteps text={t.removalInstructions} />
                </div>
              )}
            </div>
            <aside aria-label="File details">
              <h2 className="label" style={{ margin: '0 0 14px' }}>
                File details
              </h2>
              <table className="spec-table">
                <tbody>
                  {t.md5 && (
                    <tr>
                      <th scope="row">MD5</th>
                      <td>
                        <div className="hash-cell">
                          <Hash value={t.md5} id="md5" />
                          <CopyButton from="md5" />
                        </div>
                      </td>
                    </tr>
                  )}
                  {t.sha256 && (
                    <tr>
                      <th scope="row">SHA256</th>
                      <td>
                        <div className="hash-cell">
                          <Hash value={t.sha256} id="sha" />
                          <CopyButton from="sha" />
                        </div>
                      </td>
                    </tr>
                  )}
                  {t.fileSize ? (
                    <tr>
                      <th scope="row">File size</th>
                      <td>{t.fileSize.toLocaleString('en-IN')} bytes</td>
                    </tr>
                  ) : null}
                  {t.packer && (
                    <tr>
                      <th scope="row">Packer</th>
                      <td>{t.packer}</td>
                    </tr>
                  )}
                  {t.aliases && (
                    <tr>
                      <th scope="row">Aliases</th>
                      <td>{t.aliases}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </aside>
          </div>
        </section>
      </main>
    </>
  )
}
