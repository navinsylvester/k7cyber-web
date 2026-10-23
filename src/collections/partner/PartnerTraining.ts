import type { CollectionConfig } from 'payload'
import path from 'path'

import { roleAccess } from '../../access/roles'
import { QUESTION_TYPES } from '../../lib/partner/training-model'
import { maxUpload, MB } from '../uploadLimit'

/* Training content (01-requirements.md §4, 02-build-plan.md M10, decision 9): the Training Admin (a Payload user with the
   training editor role) writes tracks, courses, modules and question banks in this admin; partners read them through the
   portal only. The rows the portal owns (progress, attempts) are in PartnerTrainingRecords.ts and never edited here. */

const editor = { create: roleAccess('trainingEditor'), delete: roleAccess('admin'), read: roleAccess('trainingEditor'), update: roleAccess('trainingEditor') }
const STATUS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Retired', value: 'retired' },
]
const PARTNER_ROLE_OPTIONS = [
  { label: 'Sales', value: 'sales' },
  { label: 'Technical', value: 'technical' },
  { label: 'Partner Admin', value: 'admin' },
]

/** FR-TRN-01: the two learning tracks (Sales, Technical), each for the partner roles it names. */
export const PartnerTracks: CollectionConfig = {
  slug: 'partner-tracks',
  labels: { singular: 'Training track', plural: 'Training tracks' },
  access: editor,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'key', 'roles', 'status', 'order'],
    group: 'Partner training',
    description: 'The learning tracks (Sales, Technical). A published track shows to partner users who hold one of its roles; a track with no role shows to everyone. Courses are filed under a track.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
        { name: 'key', type: 'text', required: true, unique: true, index: true, admin: { width: '20%', description: 'sales, technical …; in the portal’s URLs.' } },
        { name: 'status', type: 'select', options: STATUS, defaultValue: 'draft', required: true, index: true, admin: { width: '20%' } },
        { name: 'order', type: 'number', defaultValue: 100, admin: { width: '20%' } },
      ],
    },
    { name: 'roles', type: 'select', hasMany: true, options: PARTNER_ROLE_OPTIONS, admin: { description: 'The partner roles this track is for (FR-TRN-01, §2). Empty: every partner user.' } },
    { name: 'description', type: 'textarea', admin: { description: 'One or two lines under the name.' } },
  ],
  timestamps: true,
}

/** FR-TRN-01, 05, 12, 14: a course of ordered modules with its test rules and an integer version. */
export const PartnerCourses: CollectionConfig = {
  slug: 'partner-courses',
  labels: { singular: 'Course', plural: 'Courses' },
  access: editor,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'track', 'status', 'version', 'order', 'updatedAt'],
    group: 'Partner training',
    description: 'A course is modules (video and reading) and one test drawn from its question bank. Publish it when its modules and bank are ready. Bump the version when the material changes (FR-TRN-14): passes on earlier versions stay valid and say which version they were on.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'title', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'track', type: 'relationship', relationTo: 'partner-tracks', required: true, index: true, admin: { width: '30%' } },
        { name: 'status', type: 'select', options: STATUS, defaultValue: 'draft', required: true, index: true, admin: { width: '20%' } },
      ],
    },
    { name: 'description', type: 'textarea', admin: { description: 'What the course covers and who it is for; on the course list and the course page.' } },
    {
      type: 'row',
      fields: [
        { name: 'order', type: 'number', defaultValue: 100, admin: { width: '25%', description: 'Within its track; lower first.' } },
        { name: 'version', type: 'number', min: 1, defaultValue: 1, required: true, admin: { width: '25%', description: 'FR-TRN-14: raise it when the material changes.' } },
        { name: 'publishedAt', type: 'date', admin: { width: '25%', readOnly: true, description: 'Set when first published.' } },
        { name: 'retiredAt', type: 'date', admin: { width: '25%', readOnly: true } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Test rules (blank: the portal settings)',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'passMark', type: 'number', min: 1, max: 100, admin: { width: '25%', description: 'FR-TRN-05: pass mark in %.' } },
            { name: 'timeLimitMinutes', type: 'number', min: 1, admin: { width: '25%', description: 'FR-TRN-05: minutes.' } },
            { name: 'questionsPerTest', type: 'number', min: 1, admin: { width: '25%', description: 'FR-TRN-04: drawn per attempt.' } },
            { name: 'requiredShare', type: 'number', min: 0.1, max: 1, admin: { width: '25%', description: 'FR-TRN-03: the share of each video (0.9 = 90%).' } },
          ],
        },
        { name: 'showAnswers', type: 'select', options: [{ label: 'The portal setting', value: 'default' }, { label: 'Show the answers', value: 'yes' }, { label: 'Score only', value: 'no' }], defaultValue: 'default', admin: { description: 'FR-TRN-06: whether the result page shows the correct answers.' } },
      ],
    },
    { name: 'modules', type: 'join', collection: 'partner-modules', on: 'course', defaultSort: 'order', admin: { description: 'The modules in order. Add one under Modules.' } },
    { name: 'questions', type: 'join', collection: 'partner-questions', on: 'course', admin: { description: 'The question bank. Add rows here or import a CSV on the partner desk (Training → the course → Import).' } },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const now = new Date().toISOString()
        const was = (originalDoc as { status?: string } | undefined)?.status
        if (data.status === 'published' && was !== 'published' && !data.publishedAt) data.publishedAt = now
        if (data.status === 'retired' && was !== 'retired') data.retiredAt = now
        if (data.status !== 'retired' && was === 'retired') data.retiredAt = null
        return data
      },
    ],
  },
  timestamps: true,
}

/** FR-TRN-01, 02, 13: a module's video (a Vimeo reference, a direct link or an uploaded file), its reading material and files. */
export const PartnerModules: CollectionConfig = {
  slug: 'partner-modules',
  labels: { singular: 'Module', plural: 'Modules' },
  access: editor,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'order', 'status', 'durationSeconds', 'updatedAt'],
    group: 'Partner training',
    description: 'One video with optional reading material and files. The video is a Vimeo URL or id (vimeo.com/123456789, with its hash when unlisted), a direct .mp4 link, or a file uploaded under Training files. The duration is learnt from the player when blank.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'title', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'course', type: 'relationship', relationTo: 'partner-courses', required: true, index: true, admin: { width: '30%' } },
        { name: 'status', type: 'select', options: STATUS.slice(0, 2), defaultValue: 'draft', required: true, index: true, admin: { width: '20%', description: 'Only Published shows and counts.' } },
      ],
    },
    { name: 'description', type: 'textarea', admin: { description: 'One line under the title on the module list.' } },
    {
      type: 'row',
      fields: [
        { name: 'video', type: 'text', admin: { width: '50%', description: 'Vimeo URL or id, or a direct media link. Ignored when a file is chosen.' } },
        { name: 'videoFile', type: 'upload', relationTo: 'partner-training-files', admin: { width: '50%', description: 'An uploaded MP4 (served only through the portal).' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'order', type: 'number', defaultValue: 100, admin: { width: '33%', description: 'Within its course; lower first.' } },
        { name: 'durationSeconds', type: 'number', min: 1, admin: { width: '33%', description: 'Seconds; blank until the player reports it.' } },
        { name: 'requiredShare', type: 'number', min: 0.1, max: 1, admin: { width: '34%', description: 'FR-TRN-03 for this module alone (0.9 = 90%). Blank: the course’s or the portal’s.' } },
      ],
    },
    { name: 'reading', type: 'textarea', admin: { description: 'Reading material shown under the video; paragraphs separated by a blank line.' } },
    { name: 'attachments', type: 'upload', relationTo: 'partner-training-files', hasMany: true, admin: { description: 'Documents the module hands out (PDF, slides); served through the portal to the users who may take the course.' } },
  ],
  timestamps: true,
}

/** FR-TRN-04, 13: the question bank, one row per question. */
export const PartnerQuestions: CollectionConfig = {
  slug: 'partner-questions',
  labels: { singular: 'Question', plural: 'Questions' },
  access: editor,
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['text', 'course', 'type', 'active', 'topic', 'updatedAt'],
    group: 'Partner training',
    description: 'The bank a course’s test is drawn from. Single choice: exactly one correct option; multiple choice: one or more correct and at least one wrong; true/false: two options, one correct. Inactive questions are never drawn. Bulk import from a CSV on the partner desk.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'course', type: 'relationship', relationTo: 'partner-courses', required: true, index: true, admin: { width: '40%' } },
        { name: 'type', type: 'select', options: QUESTION_TYPES.map((t) => ({ label: t === 'single' ? 'Single choice' : t === 'multiple' ? 'Multiple choice' : 'True or false', value: t })), defaultValue: 'single', required: true, admin: { width: '25%' } },
        { name: 'active', type: 'checkbox', defaultValue: true, admin: { width: '15%' } },
        { name: 'topic', type: 'text', admin: { width: '20%', description: 'Free word, for the ledger.' } },
      ],
    },
    { name: 'text', type: 'textarea', required: true, admin: { description: 'The question.' } },
    {
      name: 'options',
      type: 'array',
      minRows: 2,
      maxRows: 10,
      labels: { singular: 'Option', plural: 'Options' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'text', type: 'text', required: true, admin: { width: '80%' } },
            { name: 'correct', type: 'checkbox', defaultValue: false, admin: { width: '20%' } },
          ],
        },
      ],
    },
    { name: 'explanation', type: 'textarea', admin: { description: 'Shown with the correct answer on the result page when the course allows it (FR-TRN-06).' } },
    { name: 'importedAt', type: 'date', admin: { readOnly: true, description: 'Set when the row came from a CSV import.' } },
  ],
  timestamps: true,
}

/* The files training hands out: a module's video when it is uploaded rather than hosted, and its documents. Stored outside
   public/ under uploads/partner-training (git-ignored) and served only through the portal's route after the session check
   and the module's visibility; the cap is the server's 200 MB. */
export const TRAINING_DIR = path.resolve(process.cwd(), process.env.PARTNER_TRAINING_DIR || 'uploads/partner-training')
export const TRAINING_FILE_MIME = ['application/pdf', 'video/mp4', 'video/webm', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'image/png', 'image/jpeg', 'application/zip']
export const TRAINING_FILE_MAX = 200 * MB

export const PartnerTrainingFiles: CollectionConfig = {
  slug: 'partner-training-files',
  labels: { singular: 'Training file', plural: 'Training files' },
  access: editor,
  admin: { group: 'Partner training', defaultColumns: ['filename', 'mimeType', 'filesize', 'createdAt'], description: 'Videos (MP4) and documents a module uses, up to 200 MB; served only through the portal to the users who may take the course.' },
  fields: [{ name: 'uploadedBy', type: 'text', admin: { readOnly: true } }],
  hooks: {
    beforeValidate: [
      maxUpload(TRAINING_FILE_MAX),
      ({ data, req, operation }) => {
        if (operation === 'create' && data && !data.uploadedBy) data.uploadedBy = req.user?.email ?? ''
        return data
      },
    ],
  },
  upload: {
    staticDir: TRAINING_DIR,
    mimeTypes: TRAINING_FILE_MIME,
    disableLocalStorage: false,
    crop: false,
    focalPoint: false,
    filesRequiredOnCreate: true,
  },
  timestamps: true,
}
