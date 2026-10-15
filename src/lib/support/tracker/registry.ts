import type { ProductSettings } from '../product-model'

import { NoneTracker } from './none'
import type { Tracker } from './port'

export * from './port'

/* Picks the adapter the settings name. The Yodiz adapter (phase B) registers here; until then every kind resolves to link-only,
   with the Yodiz URL pattern so typed keys open the issue. */

const YODIZ_URL = process.env.YODIZ_URL_PATTERN || ''

export const trackerFor = (s: ProductSettings): Tracker => {
  switch (s.tracker.kind) {
    case 'yodiz':
      return new NoneTracker(YODIZ_URL) // phase B replaces this with the real adapter
    default:
      return new NoneTracker(YODIZ_URL)
  }
}
