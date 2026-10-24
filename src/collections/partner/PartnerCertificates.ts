import type { CollectionConfig } from 'payload'
import path from 'path'

import { roleAccess } from '../../access/roles'
import { CERT_KINDS, CERT_STATUSES } from '../../lib/partner/certificates-model'
import { maxUpload, MB } from '../uploadLimit'

import { PARTNER_TYPE_OPTIONS } from './PartnerSettings'

/* Certificates (01-requirements.md §4 FR-TRN-07–10, §5 FR-CRT-01–07; 02-build-plan.md M11, decision 12): one row per
   individual certificate (a learner's pass on a course) and per organisation certificate (requested when the rule is met,
   issued by the Channel Manager), with the facts as they stood at issue so the PDF and the public verification read the same
   whatever changes later. The PDF is a row of `partner-certificate-files`, stored outside public/ and served only through the
   portal's routes after the session and the scope have been checked, and through nothing else. Written by
   src/lib/partner/certificates.ts; read-only in the admin. Nothing here reaches Dynamics. */

const readOnly = { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('trainingEditor'), update: roleAccess('admin') }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const PartnerCertificates: CollectionConfig = {
  slug: 'partner-certificates',
  labels: { singular: 'Certificate', plural: 'Certificates' },
  access: readOnly,
  admin: {
    useAsTitle: 'number',
    group: 'Partner portal',
    defaultColumns: ['number', 'kind', 'status', 'orgName', 'userName', 'courseTitle', 'issuedAt', 'expiresAt'],
    description: 'Individual certificates (a pass on a course) and partner certificates (the organisation’s, issued by the Channel Manager once the rule is met). Written by the portal; do not edit. Issue, decline and revoke on the partner desk.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'number', type: 'text', required: true, unique: true, index: true, admin: { width: '25%', description: 'K7P-C-xxxxxx (individual) or K7P-O-xxxxxx (organisation).' } },
        { name: 'kind', type: 'select', options: CERT_KINDS.map((k) => ({ label: k === 'org' ? 'Partner certificate' : 'Individual certificate', value: k })), required: true, index: true, admin: { width: '25%' } },
        { name: 'status', type: 'select', options: CERT_STATUSES.map((s) => ({ label: cap(s), value: s })), required: true, defaultValue: 'valid', index: true, admin: { width: '25%' } },
        { name: 'file', type: 'relationship', relationTo: 'partner-certificate-files', admin: { width: '25%', description: 'The PDF as issued.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'org', type: 'relationship', relationTo: 'partner-orgs', required: true, index: true, admin: { width: '25%' } },
        { name: 'orgPartnerId', type: 'text', index: true, admin: { width: '25%' } },
        { name: 'orgName', type: 'text', admin: { width: '25%', description: 'The legal name at issue.' } },
        { name: 'orgTradeName', type: 'text', admin: { width: '25%' } },
      ],
    },
    { name: 'orgType', type: 'select', options: PARTNER_TYPE_OPTIONS, admin: { description: 'The partner type at issue (FR-CRT-03).' } },
    {
      type: 'row',
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'partner-users', index: true, admin: { width: '34%', description: 'The holder of an individual certificate.' } },
        { name: 'userName', type: 'text', admin: { width: '33%' } },
        { name: 'userEmail', type: 'text', admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'course', type: 'relationship', relationTo: 'partner-courses', index: true, admin: { width: '25%' } },
        { name: 'courseTitle', type: 'text', admin: { width: '25%' } },
        { name: 'courseVersion', type: 'number', admin: { width: '15%' } },
        { name: 'trackKey', type: 'text', index: true, admin: { width: '15%' } },
        { name: 'trackName', type: 'text', admin: { width: '20%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'attempt', type: 'relationship', relationTo: 'partner-attempts', admin: { width: '34%', description: 'The pass this certifies.' } },
        { name: 'score', type: 'number', admin: { width: '33%', description: '%' } },
        { name: 'band', type: 'select', options: ['Pass', 'Merit', 'Distinction'], admin: { width: '33%', description: 'FR-TRN-07: the score band.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'issuedAt', type: 'date', index: true, admin: { width: '25%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'expiresAt', type: 'date', index: true, admin: { width: '25%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'issuedBy', type: 'text', admin: { width: '25%', description: 'The Channel Manager, or “Portal” for an individual certificate.' } },
        { name: 'requestedAt', type: 'date', admin: { width: '25%', date: { pickerAppearance: 'dayAndTime' }, description: 'FR-CRT-02: when the rule was first met.' } },
      ],
    },
    { name: 'ruleLines', type: 'json', admin: { description: 'The organisation’s standing against the rule when the request was raised or the certificate issued: [{track, trackName, need, have}].' } },
    {
      type: 'row',
      fields: [
        { name: 'declinedAt', type: 'date', admin: { width: '25%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'declinedReason', type: 'text', admin: { width: '75%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'revokedAt', type: 'date', admin: { width: '25%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'revokedBy', type: 'text', admin: { width: '25%' } },
        { name: 'revokedReason', type: 'text', admin: { width: '50%', description: 'FR-CRT-07: recorded, read on the desk; the public page says only that it is revoked.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'supersededBy', type: 'text', admin: { width: '50%', description: 'The number of the recertification that replaced this one (FR-TRN-10).' } },
        { name: 'renewalOf', type: 'text', admin: { width: '50%', description: 'The number this one renews (FR-CRT-06).' } },
      ],
    },
    { name: 'reminded', type: 'json', admin: { description: 'The reminders sent, by days before expiry: {"60": "<when>", "30": "<when>"}.' } },
  ],
  timestamps: true,
}

export const CERTIFICATE_DIR = path.resolve(process.cwd(), process.env.PARTNER_CERTIFICATE_DIR || 'uploads/partner-certificates')

/** The PDFs, one per certificate; a few hundred KB each. Admins only in the admin; partners and K7 read through the routes. */
export const PartnerCertificateFiles: CollectionConfig = {
  slug: 'partner-certificate-files',
  labels: { singular: 'Certificate file', plural: 'Certificate files' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { group: 'Partner portal', defaultColumns: ['filename', 'number', 'filesize', 'createdAt'], description: 'The certificate PDFs as issued, written by the portal. Served only through the portal to the holder, the organisation’s admins and K7.' },
  fields: [{ name: 'number', type: 'text', index: true, admin: { readOnly: true } }],
  hooks: { beforeValidate: [maxUpload(5 * MB)] },
  upload: {
    staticDir: CERTIFICATE_DIR,
    mimeTypes: ['application/pdf'],
    disableLocalStorage: false,
    crop: false,
    focalPoint: false,
  },
  timestamps: true,
}
