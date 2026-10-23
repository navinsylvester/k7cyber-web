'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { mergeRanges, moduleComplete, pct, watchedSeconds, type Range } from '@/lib/partner/training-model'
import type { VideoSource } from '@/lib/partner/video'

/* P30 The player (FR-TRN-02, 03): the video in a hairline frame (a Vimeo embed, or the browser's own player for a direct
   link or an uploaded file served through the portal), under it the watched line that moves as the video plays. The watched
   ranges are kept here as the player ticks (a tick that jumps more than two seconds starts a new range, so skipping ahead
   leaves a gap), posted to the progress route every ten seconds and on pause, end, hide and leave; the server merges them
   with what it has and decides completion. Resume: the player seeks to the last position the server kept. Download is not
   offered: Vimeo hides it, the browser player has it removed and the context menu is blocked. */

type Props = { source: VideoSource; postUrl: string; moduleId: string; courseId: string; initial: { ranges: Range[]; duration: number | null; position: number; share: number; complete: boolean }; required: number; nextHref?: string | null }

const FLUSH_MS = 10_000
const SEEK_GAP = 2

type VimeoMsg = { event?: string; method?: string; data?: { seconds?: number; duration?: number; percent?: number }; value?: unknown }

export const Player: React.FC<Props> = ({ source, postUrl, moduleId, courseId, initial, required, nextHref }) => {
  const ranges = useRef<Range[]>(initial.ranges)
  const pending = useRef<Range[]>([])
  const current = useRef<Range | null>(null)
  const last = useRef<number | null>(null)
  const duration = useRef<number | null>(initial.duration)
  const position = useRef<number>(initial.position)
  const [share, setShare] = useState(initial.share)
  const [complete, setComplete] = useState(initial.complete)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const timer = useRef<number | null>(null)

  const recompute = useCallback(() => {
    const all = mergeRanges([...ranges.current, ...pending.current, ...(current.current ? [current.current] : [])])
    const d = duration.current
    const sh = d && d > 0 ? Math.min(1, watchedSeconds(all) / d) : 0
    setShare(sh)
    if (moduleComplete(sh, required, d)) setComplete(true)
  }, [required])

  /** The browser player's duration, read whenever it is known: `loadedmetadata` can fire before this component hydrates on a
      fast connection (seen in a same-origin frame), so the handler alone would miss it and the share would stay at zero. */
  const learnDuration = useCallback(() => {
    const v = videoRef.current
    if (!duration.current && v && Number.isFinite(v.duration) && v.duration > 0) duration.current = v.duration
  }, [])

  /** A tick from either player: extend the open range or, after a jump, close it and open another. */
  const tick = useCallback(
    (t: number) => {
      if (!Number.isFinite(t) || t < 0) return
      learnDuration()
      position.current = t
      const prev = last.current
      if (prev !== null && t > prev && t - prev <= SEEK_GAP) {
        if (current.current) current.current[1] = t
        else current.current = [prev, t]
      } else {
        if (current.current) pending.current.push(current.current)
        current.current = null
      }
      last.current = t
      recompute()
    },
    [recompute, learnDuration],
  )

  const flush = useCallback(
    (reason: string, keepalive = false) => {
      learnDuration()
      if (current.current) {
        pending.current.push(current.current)
        current.current = [current.current[1], current.current[1]]
      }
      const toSend = pending.current.filter((r) => r[1] - r[0] >= 0.25)
      pending.current = []
      if (!toSend.length && reason !== 'leave' && reason !== 'duration') return
      const body = JSON.stringify({ moduleId, courseId, ranges: toSend, duration: duration.current, position: position.current })
      setSaved('saving')
      if (keepalive && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(postUrl, new Blob([body], { type: 'application/json' }))
        if (ok) {
          ranges.current = mergeRanges([...ranges.current, ...toSend])
          setSaved('saved')
          return
        }
      }
      fetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive, credentials: 'same-origin' })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status))
          const j = (await r.json()) as { share?: number; complete?: boolean }
          ranges.current = mergeRanges([...ranges.current, ...toSend])
          if (typeof j.share === 'number') setShare((s) => Math.max(s, j.share!))
          if (j.complete) setComplete(true)
          setSaved('saved')
        })
        .catch(() => {
          // Keep the ranges for the next flush rather than lose them.
          pending.current.push(...toSend)
          setSaved('failed')
        })
    },
    [courseId, moduleId, postUrl, learnDuration],
  )

  // The ten-second flush and the leave handlers; the duration read at once when the metadata arrived before hydration.
  useEffect(() => {
    learnDuration()
    if (duration.current && !initial.duration) flush('duration')
    timer.current = window.setInterval(() => flush('timer'), FLUSH_MS)
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush('leave', true)
    }
    const onLeave = () => flush('leave', true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onLeave)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onLeave)
      flush('leave', true)
    }
  }, [flush, learnDuration, initial.duration])

  // Vimeo: the player's postMessage API; ask for the events once it says it is ready.
  useEffect(() => {
    if (source.provider !== 'vimeo') return
    const origin = 'https://player.vimeo.com'
    const send = (method: string, value?: unknown) => frameRef.current?.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), origin)
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin) return
      let m: VimeoMsg
      try {
        m = typeof e.data === 'string' ? (JSON.parse(e.data) as VimeoMsg) : (e.data as VimeoMsg)
      } catch {
        return
      }
      if (m.event === 'ready') {
        for (const ev of ['timeupdate', 'pause', 'ended', 'seeked', 'loaded']) send('addEventListener', ev)
        send('getDuration')
        if (position.current > 0) send('setCurrentTime', position.current)
      } else if (m.event === 'timeupdate' && m.data) {
        if (m.data.duration && !duration.current) {
          duration.current = m.data.duration
          flush('duration')
        }
        if (typeof m.data.seconds === 'number') tick(m.data.seconds)
      } else if (m.event === 'pause' || m.event === 'ended') {
        flush(m.event)
      } else if (m.event === 'seeked' && m.data && typeof m.data.seconds === 'number') {
        if (current.current) pending.current.push(current.current)
        current.current = null
        last.current = m.data.seconds
        position.current = m.data.seconds
      } else if (m.method === 'getDuration' && typeof m.value === 'number') {
        duration.current = m.value
        flush('duration')
        recompute()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [source.provider, flush, tick, recompute])

  // The browser player for a direct link or an uploaded file.
  const onLoaded = () => {
    const v = videoRef.current
    if (!v) return
    if (Number.isFinite(v.duration) && v.duration > 0) {
      duration.current = v.duration
      recompute()
      flush('duration')
    }
    if (position.current > 0 && position.current < (v.duration || Infinity) - 1) v.currentTime = position.current
  }
  const onSeeking = () => {
    if (current.current) pending.current.push(current.current)
    current.current = null
    last.current = videoRef.current?.currentTime ?? null
  }

  return (
    <div className="player">
      <div className={`player-frame is-${source.provider}`} onContextMenu={(e) => e.preventDefault()}>
        {source.provider === 'vimeo' ? (
          <iframe ref={frameRef} src={source.embed} title="Video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <video ref={videoRef} controls controlsList="nodownload noremoteplayback" disablePictureInPicture playsInline preload="metadata" onLoadedMetadata={onLoaded} onTimeUpdate={(e) => tick(e.currentTarget.currentTime)} onPause={() => flush('pause')} onEnded={() => flush('ended')} onSeeking={onSeeking}>
            <source src={source.src} type={source.mime} />
          </video>
        )}
      </div>
      <div className={`wline is-live${complete ? ' is-complete' : ''}`} aria-label="Watched">
        <div className="wline-bar">
          <i className={complete ? 'is-done' : undefined} style={{ width: `${Math.round(Math.min(1, share) * 100)}%` }} />
          <b style={{ left: `${Math.round(required * 100)}%` }} title={`${pct(required)} needed`} />
        </div>
        <div className="wline-words">
          <span className="label" aria-live="polite">
            {complete ? `Module complete · ${pct(share)} watched` : share > 0 ? `${pct(share)} watched · ${pct(required)} needed · skipping ahead does not count` : `${pct(required)} of the video completes this module · skipping ahead does not count`}
          </span>
          <span className="label muted">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Progress saved' : saved === 'failed' ? 'Not saved yet · retrying' : initial.position > 0 ? 'Resumes where you left off' : ''}</span>
        </div>
      </div>
      {complete && nextHref ? (
        <p className="more">
          <a className="btn btn-primary" href={nextHref}>
            Next module →
          </a>
        </p>
      ) : null}
    </div>
  )
}
