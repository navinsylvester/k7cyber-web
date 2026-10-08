# Field
One labelled form control: an underline in `ink` that turns `signal` on focus and `acc-ink` on error, with the label above in mono and the error below.

**Use** for every input, select and textarea in enquiry, demo, quote, partner and contact forms. Group fields in `form-grid` (two columns from 520px, one below); span the message with `span-2`. Checkboxes are `check`: an 18px square that fills `signal` when checked.

**Provide** `id`, `label` (mark required fields with * in the label, and say "Fields marked * are mandatory" once above the form), `type`, placeholder, value, and the error text. Selects get `control is-select` for the chevron. Country defaults to India; State defaults to "Select a State".

**Don't** box the inputs, round them, add icons inside them, or colour the label. Placeholders are examples, not instructions. Error copy says what to fix.

**shadcn** Form + Input / Select / Textarea / Checkbox with `border-0 border-b-2 rounded-none bg-transparent px-0 text-[19px] focus-visible:ring-0 focus-visible:border-primary`; Label with the `label` type.
