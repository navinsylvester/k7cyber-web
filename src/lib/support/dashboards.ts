import 'server-only'

import { buildQuery, entity, fetchXml, list, retrieve, type DataverseAuth, type Row, fv } from '@/lib/dataverse'

import { HOUR, memo } from './memo'
import { PRIORITY_CRITICAL } from './options'

/* Dashboards (01-requirements.md §4.4): the two phase-1 dashboards are rebuilt from the chart definitions Dataverse already holds.
   Each chart runs its own aggregate FetchXML with the filters of the view it is bound to, as the model-driven app does. */

export type Dashboard = { slug: string; name: string; description: string; charts: { chartId: string; viewId: string }[] }

const ACTIVE_CASES_VIEW = '00000000-0000-0000-00aa-000010001032'

export const DASHBOARDS: Dashboard[] = [
  {
    slug: 'active-cases',
    name: 'Active cases',
    description: 'Active Cases Dashboard - Rafi: who holds what, by product, issue, status reason and vertical.',
    charts: [
      { chartId: '4143b74e-4a07-4d01-9ffe-2cdcaa4208fd', viewId: ACTIVE_CASES_VIEW }, // Active Cases by Agent
      { chartId: '07d1c17c-c837-e811-813f-5065f38c2851', viewId: ACTIVE_CASES_VIEW }, // Case by Product
      { chartId: 'ff400f22-c937-e811-813f-5065f38c2851', viewId: ACTIVE_CASES_VIEW }, // Case by Issue
      { chartId: 'a984c824-c837-e811-813f-5065f38c2851', viewId: ACTIVE_CASES_VIEW }, // Case by Status Reason
      { chartId: 'e93b9ec2-4a36-e811-813e-5065f38c2851', viewId: ACTIVE_CASES_VIEW }, // Product by Vertical Type
      { chartId: 'b9687708-255f-df11-ae90-00155d2e3002', viewId: '429bd987-ac6f-df11-986c-00155d2e3002' }, // Cases by Origin (Per Day)
    ],
  },
  {
    slug: 'service-manager',
    name: 'Service manager',
    description: 'Customer Service Manager Dashboard: load per agent, SLA status over the week, priorities and queues.',
    charts: [
      { chartId: '4143b74e-4a07-4d01-9ffe-2cdcaa4208fd', viewId: ACTIVE_CASES_VIEW },
      { chartId: '997cbf5a-1c09-4990-b174-a8ef1530092b', viewId: ACTIVE_CASES_VIEW }, // Cases by SLA Status Over Week
      { chartId: '475e6f02-32ae-4081-8cb8-e3e24a9fbc0f', viewId: '2d8d408d-c255-4587-9e34-596d496e6738' },
      { chartId: 'dde82758-2782-de11-9ff3-00155da3b012', viewId: ACTIVE_CASES_VIEW }, // Case Mix (By Priority)
      { chartId: 'fdb919bb-c6fc-4fc8-8fa5-67ace68e41d1', viewId: 'aa69e7e2-913a-4a5a-8609-8ca443554909' },
    ],
  },
]

export type ChartType = 'bar' | 'column' | 'pie' | 'line' | 'doughnut' | 'funnel' | 'area'
export type ChartSeries = { label: string; value: number; critical?: boolean }
export type ChartData = { id: string; name: string; type: ChartType; entity: string; series: ChartSeries[]; total: number; viewName: string; error?: string }

type ChartDef = { id: string; name: string; entity: string; fetch: string; type: ChartType }

const ENTITY_SETS: Record<string, string> = { incident: 'incidents', activitypointer: 'activitypointers', queueitem: 'queueitems', email: 'emails', phonecall: 'phonecalls', task: 'tasks', knowledgearticle: 'knowledgearticles', contact: 'contacts', account: 'accounts', systemuser: 'systemusers', k7_rfe: 'k7_rfes', k7_defect: 'k7_defects', incidentresolution: 'incidentresolutions' }
const entitySet = (logical: string) => ENTITY_SETS[logical] ?? `${logical}s`

const chartType = (presentation: string): ChartType => {
  const t = (presentation.match(/ChartType="(\w+)"/i)?.[1] ?? 'column').toLowerCase()
  if (t === 'bar' || t === 'column' || t === 'pie' || t === 'line' || t === 'doughnut' || t === 'funnel' || t === 'area') return t
  if (t === 'stackedcolumn' || t === 'stackedcolumn100') return 'column'
  if (t === 'stackedbar' || t === 'stackedbar100') return 'bar'
  return 'column'
}

const getChartDef = (auth: DataverseAuth, chartId: string): Promise<ChartDef> =>
  memo(`chart:${chartId}`, HOUR, async () => {
    const r = await retrieve<Row>(auth, `${entity('savedqueryvisualizations', chartId)}?$select=name,datadescription,presentationdescription,primaryentitytypecode`)
    const data = String(r.datadescription ?? '')
    // `<fetch` must not match `<fetchcollection>`: the element name ends at whitespace or `>`.
    const fetch = data.match(/<fetch[\s>][\s\S]*?<\/fetch>/)?.[0] ?? ''
    return { id: chartId, name: String(r.name ?? ''), entity: String(r.primaryentitytypecode ?? 'incident'), fetch, type: chartType(String(r.presentationdescription ?? '')) }
  })

const getViewFetch = (auth: DataverseAuth, viewId: string): Promise<{ name: string; fetchxml: string }> =>
  memo(`viewfetch:${viewId}`, HOUR, async () => {
    try {
      const r = await retrieve<Row>(auth, `${entity('savedqueries', viewId)}?$select=name,fetchxml`)
      return { name: String(r.name ?? ''), fetchxml: String(r.fetchxml ?? '') }
    } catch {
      return { name: '', fetchxml: '' }
    }
  })

/** The root-level `<filter>` blocks of a view, to be injected into the chart's aggregate fetch. */
const rootFilters = (fetchxml: string): string => {
  const entityMatch = fetchxml.match(/<entity\b[^>]*>([\s\S]*)<\/entity>/)
  if (!entityMatch) return ''
  // Strip link-entities, then keep filters.
  const body = entityMatch[1]!.replace(/<link-entity\b[\s\S]*?<\/link-entity>/g, '')
  return (body.match(/<filter\b[\s\S]*?<\/filter>/g) ?? []).join('')
}

const combine = (chartFetch: string, viewFetch: string): string => {
  const filters = rootFilters(viewFetch)
  if (!filters) return chartFetch
  const open = chartFetch.match(/<entity\b[^>]*>/)
  if (!open) return chartFetch
  const at = chartFetch.indexOf(open[0]) + open[0].length
  return chartFetch.slice(0, at) + filters + chartFetch.slice(at)
}

const groupAliases = (fetch: string): { group: string[]; measures: string[] } => {
  const group = [...fetch.matchAll(/<attribute[^>]*groupby="true"[^>]*alias="([^"]+)"/g), ...fetch.matchAll(/<attribute[^>]*alias="([^"]+)"[^>]*groupby="true"/g)].map((m) => m[1]!)
  const measures = [...fetch.matchAll(/<attribute[^>]*aggregate="\w+"[^>]*alias="([^"]+)"/g), ...fetch.matchAll(/<attribute[^>]*alias="([^"]+)"[^>]*aggregate="\w+"/g)].map((m) => m[1]!)
  return { group: [...new Set(group)], measures: [...new Set(measures)] }
}

export const runChart = async (auth: DataverseAuth, chartId: string, viewId: string): Promise<ChartData> => {
  const [def, view] = await Promise.all([getChartDef(auth, chartId), getViewFetch(auth, viewId)])
  const base: ChartData = { id: chartId, name: def.name, type: def.type, entity: def.entity, series: [], total: 0, viewName: view.name }
  if (!def.fetch) return { ...base, error: 'No data definition' }
  try {
    const xml = combine(def.fetch, view.fetchxml)
    const r = await fetchXml<Row>(auth, entitySet(def.entity), xml)
    const { group, measures } = groupAliases(def.fetch)
    const g = group[0]
    const m = measures[0]
    if (!g || !m) return { ...base, error: 'Unsupported chart definition' }
    const labelOf = (row: Row, alias: string) => fv(row, alias) || (row[alias] === null || row[alias] === undefined ? '(none)' : String(row[alias]))
    const series: ChartSeries[] = r.value.map((row) => {
      // Two group-bys (a stacked chart in Dynamics) become one label per combination, in the definition's order.
      const label = group.map((a) => labelOf(row, a)).join(' · ')
      const value = Number(row[m] ?? 0)
      const critical = g.includes('priority') ? row[g] === PRIORITY_CRITICAL : undefined
      return { label, value, critical }
    })
    // Keep the definition's order for dates; sort descending by value otherwise so the biggest bar reads first.
    const dated = /dategrouping/.test(def.fetch)
    if (!dated) series.sort((a, b) => b.value - a.value)
    // A line only makes sense over time; Dynamics draws categories as lines too, the portal does not.
    if (!dated && (base.type === 'line' || base.type === 'area')) base.type = 'bar'
    const top = series.slice(0, 12)
    const rest = series.slice(12).reduce((s, x) => s + x.value, 0)
    if (rest > 0) top.push({ label: `Other (${series.length - 12})`, value: rest })
    return { ...base, series: top, total: series.reduce((s, x) => s + x.value, 0) }
  } catch (e) {
    return { ...base, error: (e as Error).message }
  }
}

export const runDashboard = async (auth: DataverseAuth, slug: string): Promise<{ dashboard: Dashboard; charts: ChartData[] } | null> => {
  const d = DASHBOARDS.find((x) => x.slug === slug)
  if (!d) return null
  const charts = await Promise.all(d.charts.map((c) => runChart(auth, c.chartId, c.viewId)))
  return { dashboard: d, charts }
}

/** Cases created per day over the last 14 days (for the workspace home). */
export const creationTrend = async (auth: DataverseAuth): Promise<ChartSeries[]> => {
  const xml = `<fetch mapping="logical" aggregate="true"><entity name="incident"><attribute alias="n" name="incidentid" aggregate="count" /><attribute groupby="true" alias="d" dategrouping="day" name="createdon" /><attribute groupby="true" alias="mo" dategrouping="month" name="createdon" /><filter><condition attribute="createdon" operator="last-x-days" value="14" /></filter><order alias="mo" /><order alias="d" /></entity></fetch>`
  try {
    const r = await fetchXml<Row>(auth, 'incidents', xml)
    return r.value.map((row) => ({ label: `${String(row.d).padStart(2, '0')}/${String(row.mo).padStart(2, '0')}`, value: Number(row.n ?? 0) }))
  } catch {
    return []
  }
}

/** Status-reason spread of the active cases (workspace home). */
export const activeByStatus = async (auth: DataverseAuth): Promise<ChartSeries[]> => {
  const p = await list<Row>(auth, buildQuery('incidents', { select: ['incidentid', 'statuscode'], filter: 'statecode eq 0', top: 5000 }), 5000).catch(() => ({ value: [] as Row[] }))
  const m = new Map<string, number>()
  for (const r of p.value) m.set(fv(r, 'statuscode'), (m.get(fv(r, 'statuscode')) ?? 0) + 1)
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
