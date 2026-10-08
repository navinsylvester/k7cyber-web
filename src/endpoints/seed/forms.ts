import type { FormData } from './pages'

const para = (text: string) => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text, version: 1 }] }],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

const text = (name: string, label: string, required = true) => ({ blockType: 'text' as const, name, label, required })
const email = (name: string, label: string, required = true) => ({ blockType: 'email' as const, name, label, required })
const textarea = (name: string, label: string, required = false) => ({ blockType: 'textarea' as const, name, label, required })
const checkbox = (name: string, label: string, required = false) => ({ blockType: 'checkbox' as const, name, label, required })
const number = (name: string, label: string, required = true) => ({ blockType: 'number' as const, name, label, required })
const select = (name: string, label: string, options: string[], required = false) => ({
  blockType: 'select' as const,
  name,
  label,
  required,
  options: options.map((o) => ({ label: o, value: o })),
})

const INDIAN_STATES = ['Andhra Pradesh', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal', 'Other']

/* The shared Enquiry / Request demo field set from the content doc; Request quote adds the sizing field. */
const estateFields = (sizing: boolean) => [
  text('company', 'Company name'),
  text('contactPerson', 'Contact person'),
  email('email', 'Contact email'),
  text('phone', 'Contact phone'),
  { blockType: 'country' as const, name: 'country', label: 'Country', required: true },
  select('state', 'State', INDIAN_STATES, true),
  text('city', 'City'),
  ...(sizing ? [number('employees', 'No. of employees')] : []),
  textarea('comment', 'Comment'),
  checkbox('consent', 'I agree to the collection and processing of my personal data for the stated purpose', true),
  checkbox('updates', 'I would like to receive updates from K7 CyberSecurity'),
]

export const forms: FormData[] = [
  {
    title: 'Enquiry',
    submitButtonLabel: 'Submit',
    confirmationType: 'message',
    confirmationMessage: para('Thank you. A K7 engineer will come back to you within one working day.'),
    fields: estateFields(false),
  },
  {
    title: 'Request demo',
    submitButtonLabel: 'Submit',
    confirmationType: 'message',
    confirmationMessage: para('Thank you. A K7 engineer will be in touch to arrange your demo.'),
    fields: estateFields(false),
  },
  {
    title: 'Request quote · XDR',
    submitButtonLabel: 'Submit',
    confirmationType: 'message',
    confirmationMessage: para('Thank you. We will come back with a quote for K7 Seventh Sense XDR.'),
    fields: estateFields(true),
  },
  {
    title: 'Contact enquiry',
    submitButtonLabel: 'Submit',
    confirmationType: 'message',
    confirmationMessage: para('Thank you. Your enquiry has reached the right team and we will reply shortly.'),
    fields: [
      text('firstName', 'First name'),
      text('lastName', 'Last name'),
      text('company', 'Company name'),
      email('email', 'Email address'),
      { blockType: 'country' as const, name: 'country', label: 'Country', required: false },
      text('phone', 'Phone', false),
      select('enquiryType', 'Type of enquiry', ['Sales', 'Support', 'Press and Media Relations', 'Other Enquiry']),
      textarea('message', 'Enter your message here', true),
    ],
  },
]
