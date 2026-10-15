# Field
One labelled form control: an underline in `ink` that turns `signal` on focus and `acc-ink` on error, with the label above in mono and the error below.

**Use** for every input, select and textarea in enquiry, demo, quote, partner and contact forms. Group fields in `form-grid` (two columns from 520px, one below); span the message with `span-2`. Checkboxes are `check`: an 18px square that fills `signal` when checked.

**Provide** `id`, `label` (mark required fields with * in the label, and say "Fields marked * are mandatory" once above the form), `type`, placeholder, value, and the error text. Selects get `control is-select` for the chevron. Country defaults to India; State defaults to "Select a State".

**Don't** box the inputs, round them, add icons inside them, or colour the label. Placeholders are examples, not instructions. Error copy says what to fix.

**Build** the `field` and `control` markup from `bundle.css` around native inputs, selects, textareas and checkboxes, never a widget; the `FormSheet` block renders form-builder documents with it, and the Labs and Support forms use the same markup.
