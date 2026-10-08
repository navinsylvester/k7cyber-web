'use client'
import { type RowLabelProps, useRowLabel } from '@payloadcms/ui'

// One row label for every array in the site: shows the row's label, title, heading or name.
export const RowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>()
  const text = ['label', 'title', 'heading', 'name', 'code'].map((k) => data?.[k]).find((v) => typeof v === 'string' && v)
  const n = rowNumber !== undefined ? String(rowNumber + 1).padStart(2, '0') : ''
  return <div>{text ? `${n} · ${text}` : `Row ${n}`}</div>
}
