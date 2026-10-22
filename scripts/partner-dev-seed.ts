/* A test partner organisation and one Partner Admin for development of the partner portal (docs/partner-portal/04-portal-guide.md §1):
     pnpm partner:seed-dev you@example.com ["Your Name"]
   Idempotent: the organisation PP-TEST (partner ID K7P-00000) is created once; the user is created or moved into it. Test rows carry the
   PP-TEST prefix the build plan asks for (02-build-plan.md §0) and never reach the CRM. */
import 'dotenv/config'
import config from '@payload-config'
import { getPayload } from 'payload'

const email = (process.argv[2] ?? '').trim().toLowerCase()
const name = process.argv[3] ?? 'Test Partner Admin'
if (!email.includes('@')) {
  console.error('Usage: pnpm partner:seed-dev <email> ["Name"]')
  process.exit(1)
}

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'partner-orgs', where: { partnerId: { equals: 'K7P-00000' } }, limit: 1 })
const org =
  existing.docs[0] ??
  (await payload.create({
    collection: 'partner-orgs',
    data: { partnerId: 'K7P-00000', type: 'var', status: 'approved', name: 'PP-TEST Partner Private Limited', tradeName: 'PP-TEST Partner', country: 'India', state: 'Tamil Nadu', city: 'Chennai', regions: ['S'], website: 'https://example.com' },
  }))
console.log(`organisation ${org.partnerId} (${org.id}) ${existing.docs[0] ? 'exists' : 'created'}`)

const users = await payload.find({ collection: 'partner-users', where: { email: { equals: email } }, limit: 1 })
const u = users.docs[0]
if (u) {
  await payload.update({ collection: 'partner-users', id: u.id, data: { org: org.id, status: 'active', roles: ['admin', 'sales', 'technical'] } })
  console.log(`user ${email} updated: active, every role, in ${org.partnerId}`)
} else {
  await payload.create({ collection: 'partner-users', data: { org: org.id, email, name, roles: ['admin', 'sales', 'technical'], status: 'active', invitedAt: new Date().toISOString() } })
  console.log(`user ${email} created in ${org.partnerId}`)
}
await payload.create({
  collection: 'partner-audit',
  data: { actorKind: 'system', actorName: 'partner-dev-seed', object: 'partner-orgs', objectId: String(org.id), objectLabel: org.partnerId, action: 'org.seeded', to: 'approved', orgId: String(org.id), comment: 'Development seed' },
})
process.exit(0)
