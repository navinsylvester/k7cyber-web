import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { PartnerApplications } from './collections/partner/PartnerApplications'
import { PartnerAudit } from './collections/partner/PartnerAudit'
import { PartnerCollateral } from './collections/partner/PartnerCollateral'
import { PartnerCollateralFiles } from './collections/partner/PartnerCollateralFiles'
import { PartnerCounters } from './collections/partner/PartnerCounters'
import { PartnerDealFiles } from './collections/partner/PartnerDealFiles'
import { PartnerDeals } from './collections/partner/PartnerDeals'
import { PartnerEligibility } from './collections/partner/PartnerEligibility'
import { PartnerNotifications } from './collections/partner/PartnerNotifications'
import { PartnerOrgs } from './collections/partner/PartnerOrgs'
import { PartnerOutbox } from './collections/partner/PartnerOutbox'
import { PartnerProducts } from './collections/partner/PartnerProducts'
import { PartnerSchemeFiles } from './collections/partner/PartnerSchemeFiles'
import { PartnerSchemeRegistrations } from './collections/partner/PartnerSchemeRegistrations'
import { PartnerSchemes } from './collections/partner/PartnerSchemes'
import { PartnerSettings } from './collections/partner/PartnerSettings'
import { PartnerSyncRuns } from './collections/partner/PartnerSyncRuns'
import { PartnerUsers } from './collections/partner/PartnerUsers'
import { Authors } from './collections/research/Authors'
import { Products } from './collections/research/Products'
import { ReportFiles } from './collections/research/ReportFiles'
import { ReportLeads } from './collections/research/ReportLeads'
import { Threats } from './collections/research/Threats'
import { ThreatReports } from './collections/research/ThreatReports'
import { Vulnerabilities } from './collections/research/Vulnerabilities'
import { ProductEvidence } from './collections/support/ProductEvidence'
import { ProductItemCases } from './collections/support/ProductItemCases'
import { ProductItemEvents } from './collections/support/ProductItemEvents'
import { ProductItems } from './collections/support/ProductItems'
import { ProductMirror } from './collections/support/ProductMirror'
import { ProductSettings } from './collections/support/ProductSettings'
import { SupportCareFlags } from './collections/support/SupportCareFlags'
import { SupportCsat } from './collections/support/SupportCsat'
import { SupportSettings } from './collections/support/SupportSettings'
import { SupportSlaEvents } from './collections/support/SupportSlaEvents'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  collections: [Pages, Posts, Categories, Authors, Vulnerabilities, Products, Threats, ThreatReports, ReportFiles, ReportLeads, SupportSlaEvents, SupportCsat, SupportCareFlags, ProductItems, ProductItemCases, ProductItemEvents, ProductEvidence, ProductMirror, PartnerOrgs, PartnerUsers, PartnerApplications, PartnerAudit, PartnerNotifications, PartnerOutbox, PartnerCounters, PartnerProducts, PartnerDeals, PartnerDealFiles, PartnerSyncRuns, PartnerCollateral, PartnerCollateralFiles, PartnerSchemes, PartnerSchemeFiles, PartnerSchemeRegistrations, PartnerEligibility, Media, Users],
  // One limit for every upload (Payload's multipart parser reads only this): the partner collateral's 200 MB (FR-MKT-02, decision 13).
  // The other upload collections keep their own smaller caps through `maxUpload` in src/collections/uploadLimit.ts.
  upload: { limits: { fileSize: 200 * 1024 * 1024 }, requestSizeLimit: 201 * 1024 * 1024 },
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, SupportSettings, ProductSettings, PartnerSettings],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
