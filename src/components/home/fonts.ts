import { Barlow, Big_Shoulders } from 'next/font/google'

/* The homepage's own faces (designs/home/Seventh-Sense-Landing.html): Big Shoulders for the colossal condensed display,
   Barlow for the running text. Self-hosted by next/font like Archivo and Plex Mono, and loaded on the homepage only. */
export const bigShoulders = Big_Shoulders({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-big-shoulders',
  display: 'swap',
  // next/font has no metrics to size a fallback for this face; the stack in home.css falls back to Arial Narrow.
  adjustFontFallback: false,
})

export const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})
