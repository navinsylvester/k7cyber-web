'use client'
import React, { useState } from 'react'

/* Every ID and hash is copyable (L1). */
export const CopyButton: React.FC<{ text?: string; from?: string; label?: string; className?: string; url?: boolean }> = ({ text, from, label = 'Copy', className = 'copy', url }) => {
  const [done, setDone] = useState(false)
  const copy = async () => {
    const value = url ? location.href : text ?? (from ? (document.getElementById(from)?.getAttribute('data-hash') ?? document.getElementById(from)?.textContent ?? '') : '')
    try {
      await navigator.clipboard.writeText(value.trim())
      setDone(true)
      setTimeout(() => setDone(false), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button className={className} type="button" onClick={copy}>
      {done ? 'Copied' : label}
    </button>
  )
}

export const CopyHashes: React.FC<{ tableId: string }> = ({ tableId }) => {
  const [done, setDone] = useState(false)
  return (
    <button
      className="copy"
      type="button"
      onClick={async () => {
        const list = [...document.querySelectorAll(`#${tableId} [data-hash]`)].map((h) => h.getAttribute('data-hash')).join('\n')
        try {
          await navigator.clipboard.writeText(list)
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? 'Copied' : 'Copy all hashes'}
    </button>
  )
}
