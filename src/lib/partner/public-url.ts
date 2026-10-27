import { getServerSideURL } from '@/utilities/getURL'

/* The address partners reach the portal at, for every absolute link the portal hands out (notices, the status link, certificates
   and their QR). Read at run time: NEXT_PUBLIC_SERVER_URL is fixed into the build, while the host people sign in through is
   AUTH_URL (Auth.js reads it per request), so a test host whose address changes needs no rebuild. PARTNER_PUBLIC_URL overrides both. */
export const partnerPublicUrl = (): string =>
  (process.env.PARTNER_PUBLIC_URL || process.env.AUTH_URL || getServerSideURL()).replace(/\/api\/auth\/?$/, '').replace(/\/$/, '')
