import React from 'react'

/* Behaviour details in WordPress are plain text: "1. Creates Registry:\n Adds data \n\t\t<value> \n under \n\t\t <key>…".
   Rendered as a log of operation/value/key rows when they parse, else as preformatted text. */
/** ACF stored some bytes as \\xNN escapes (microsoft\\xae); decode them to characters. */
export const unescapeBytes = (t: string) => t.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))

export const parseBehaviour = (text: string): { title?: string; entries: { op: string; val: string; key: string }[] } | null => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const entries: { op: string; val: string; key: string }[] = []
  let title: string | undefined
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    if (/^\d+\.\s/.test(l) && !title) {
      title = l.replace(/^\d+\.\s*/, '').replace(/:$/, '')
      continue
    }
    if (/^(adds|sets|creates|modifies|deletes|writes)\b/i.test(l)) {
      const op = l
      const val = lines[i + 1] ?? ''
      const under = lines[i + 2] ?? ''
      const key = lines[i + 3] ?? ''
      if (/^under$/i.test(under)) {
        entries.push({ op, val, key })
        i += 3
      }
    }
  }
  return entries.length ? { title, entries } : null
}

export const ThreatLog: React.FC<{ text: string }> = ({ text: raw }) => {
  const text = unescapeBytes(raw)
  const parsed = parseBehaviour(text)
  if (!parsed) return <pre style={{ whiteSpace: 'pre-wrap', font: '400 13px/1.55 var(--font-mono)', margin: 0 }}>{text}</pre>
  const first = parsed.entries.slice(0, 5)
  const rest = parsed.entries.slice(5)
  const Row = ({ e }: { e: { op: string; val: string; key: string } }) => (
    <li>
      <span className="op label">{e.op}</span>
      <span className="val">{e.val}</span>
      <span className="op label">Under</span>
      <span className="key">{e.key}</span>
    </li>
  )
  return (
    <div className="log">
      <div className="log-head label">
        <span>{parsed.title ?? 'Registry writes'}</span>
        <span className="muted">{parsed.entries.length} entries</span>
      </div>
      <ol>
        {first.map((e, i) => (
          <Row e={e} key={i} />
        ))}
      </ol>
      {rest.length > 0 && (
        <details>
          <summary className="label">Show all {parsed.entries.length} entries</summary>
          <ol>
            {rest.map((e, i) => (
              <Row e={e} key={i} />
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

/* Removal instructions are numbered lines; indented lines under a step are keys shown in a pre. */
export const RemovalSteps: React.FC<{ text: string }> = ({ text: raw }) => {
  const text = unescapeBytes(raw)
  const steps: { text: string; keys: string[] }[] = []
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.replace(/\s+$/, '')
    if (!l.trim()) continue
    const m = l.match(/^\s*\d+\.\s*(.*)$/)
    if (m) steps.push({ text: m[1]!, keys: [] })
    else if (steps.length) steps[steps.length - 1]!.keys.push(l.trim())
    else steps.push({ text: l.trim(), keys: [] })
  }
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span>
            {s.text}
            {s.keys.length > 0 && <pre>{s.keys.join('\n')}</pre>}
          </span>
        </li>
      ))}
    </ol>
  )
}
