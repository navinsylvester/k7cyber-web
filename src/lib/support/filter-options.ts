/* Matching for the type-to-filter field (FilterSelect, Field README "Type to filter"): what the reader types narrows a long
   reference list (a state's cities: 453 in Andhra Pradesh) to the entries that contain it, best first. */

export type FilterOption = { id: string; name: string }

/** Case, accents and runs of spaces do not matter: "tamil  nadu" finds Tamil Nadu, "pondi" Pondicherry. */
export const normalise = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** The options that contain the query, in three bands, each in the list's own (alphabetical) order: the name starts with it,
    then a word in the name starts with it ("nadu" → Tamil Nadu), then it appears anywhere. An empty query keeps every option. */
export const filterOptions = <T extends FilterOption>(options: T[], query: string): T[] => {
  const q = normalise(query)
  if (!q) return options
  const bands: T[][] = [[], [], []]
  for (const o of options) {
    const n = normalise(o.name)
    const at = n.indexOf(q)
    if (at < 0) continue
    bands[at === 0 ? 0 : /[\s\-(./,]/.test(n[at - 1]!) ? 1 : 2]!.push(o)
  }
  return bands.flat()
}

/** What typed text settles on when the reader leaves the field: the option it names exactly, else the only one it matches, else
    nothing (the field goes back to its last choice). */
export const settle = <T extends FilterOption>(options: T[], text: string): T | null => {
  const t = normalise(text)
  if (!t) return null
  const exact = options.find((o) => normalise(o.name) === t)
  if (exact) return exact
  const m = filterOptions(options, text)
  return m.length === 1 ? m[0]! : null
}

/** One option per name, in the list's order (the first of each name wins), except that `keep` (the record's current choice) is
    always the one shown for its name. A reference list can carry the same name twice: UAT has its own cities next to the
    production set the seed copied in (2,091 and 2,202, the same names), and production has a few of its own. */
export const uniqueByName = <T extends FilterOption>(options: T[], keep = ''): T[] => {
  const kept = keep ? options.find((o) => o.id.toLowerCase() === keep.toLowerCase()) : undefined
  const keptName = kept ? normalise(kept.name) : null
  const seen = new Set<string>()
  const out: T[] = []
  for (const o of options) {
    const n = normalise(o.name)
    if (n === keptName && o !== kept) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(o)
  }
  return out
}
