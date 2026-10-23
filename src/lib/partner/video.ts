/* The video host behind an adapter (02-build-plan.md decision 18, FR-TRN-02): a module names its video as a reference the
   Training Admin types in the admin (a Vimeo URL or id, a direct media URL) or as a file uploaded to `partner-training-files`;
   this file turns the reference into what the player needs and nothing else. Vimeo is the default assumption for production
   (domain-restricted, no download button; the embed reports time through the player's postMessage API); a direct URL or an
   uploaded file plays in the browser's own `<video>` with the download control hidden, which is what development and a host
   without a Vimeo account use. Pure: no network, no secrets; the client component imports the types. */

export type VideoProvider = 'vimeo' | 'url' | 'file'

export type VideoRef =
  | { provider: 'vimeo'; id: string; hash: string }
  | { provider: 'url'; src: string }
  | { provider: 'file'; fileId: string; name: string; mime: string }

/** What the player renders: an iframe for Vimeo, a `<video>` source for a URL or a file served through the portal's route. */
export type VideoSource = { provider: 'vimeo'; embed: string } | { provider: 'url' | 'file'; src: string; mime: string }

const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']
const MEDIA = /\.(mp4|m4v|webm|mov|m3u8)(\?|#|$)/i

/** Reads a typed reference: `vimeo:123456`, `123456`, a vimeo.com or player.vimeo.com URL (with the unlisted hash when it has
    one), or a URL that ends in a media extension. Anything else is null, so the admin learns at once that the video will not play. */
export const parseVideoRef = (input: string | null | undefined): VideoRef | null => {
  const v = (input ?? '').trim()
  if (!v) return null
  const m = /^vimeo:(\d+)(?:[/:]([0-9a-f]+))?$/i.exec(v)
  if (m) return { provider: 'vimeo', id: m[1]!, hash: m[2] ?? '' }
  if (/^\d{6,12}$/.test(v)) return { provider: 'vimeo', id: v, hash: '' }
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (VIMEO_HOSTS.includes(url.hostname)) {
    // vimeo.com/123456, vimeo.com/123456/abcdef12 (unlisted), player.vimeo.com/video/123456?h=abcdef12, vimeo.com/channels/x/123456
    const parts = url.pathname.split('/').filter(Boolean)
    const i = parts.findIndex((p) => /^\d{6,12}$/.test(p))
    if (i < 0) return null
    const next = parts[i + 1] ?? ''
    const hash = url.searchParams.get('h') ?? (/^[0-9a-f]{6,}$/i.test(next) ? next : '')
    return { provider: 'vimeo', id: parts[i]!, hash }
  }
  if (MEDIA.test(url.pathname + url.search)) return { provider: 'url', src: url.toString() }
  return null
}

/** The reference for an uploaded file. */
export const fileVideoRef = (f: { id: string; name: string; mime: string }): VideoRef => ({ provider: 'file', fileId: f.id, name: f.name, mime: f.mime })

/** What to render. `fileUrl` makes the portal route for an uploaded file, so the bytes never leave the session check. */
export const videoSource = (ref: VideoRef, fileUrl: (fileId: string) => string): VideoSource => {
  if (ref.provider === 'vimeo') {
    const q = new URLSearchParams({ dnt: '1', pip: '0', title: '0', byline: '0', portrait: '0', playsinline: '1' })
    if (ref.hash) q.set('h', ref.hash)
    return { provider: 'vimeo', embed: `https://player.vimeo.com/video/${ref.id}?${q.toString()}` }
  }
  if (ref.provider === 'url') return { provider: 'url', src: ref.src, mime: mimeOfUrl(ref.src) }
  return { provider: 'file', src: fileUrl(ref.fileId), mime: ref.mime || 'video/mp4' }
}

const mimeOfUrl = (src: string): string => {
  const m = MEDIA.exec(src)
  const ext = (m?.[1] ?? 'mp4').toLowerCase()
  return ext === 'webm' ? 'video/webm' : ext === 'm3u8' ? 'application/vnd.apple.mpegurl' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'
}

export const VIDEO_PROVIDER_LABEL: Record<VideoProvider, string> = { vimeo: 'Vimeo', url: 'Direct link', file: 'Uploaded file' }

/** The reference in words for the K7 ledger. */
export const videoRefText = (ref: VideoRef | null): string => (!ref ? 'No video' : ref.provider === 'vimeo' ? `Vimeo ${ref.id}` : ref.provider === 'url' ? 'Direct link' : `File · ${ref.name}`)
