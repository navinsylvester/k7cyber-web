# EnquiryForm
The one lead form behind every Enquire, Request Demo and Request Quote link: a `.g-panel` sheet with a tab naming the form and the product, the field grid, consent and Submit.

**Use** once per form page, and inline at the foot of Partners and Contact Us. The tab's right label is the product (MDR, XDR, SD-WAN…), which also tags the submission. Enquiry and Demo forms carry company, contact person, email, phone, country, state, city, comment; Demo and Quote add "No. of employees". Partners replaces the tab label with "Let's Talk" and adds "My inquiry is regarding" (Channel Partner, MSP, Other). Contact Us adds "Type of enquiry" (Sales, Support, Press and Media Relations, Other Enquiry).

**Provide** the product tag, the field list, the privacy-policy href and the submit handler. On success, replace the form with a `notice` that says what happens next; never navigate away.

**Don't** add a hero above the form, box it, or split it across steps. Keep "Select all" as the first checkbox, as the content specifies.

**Build** the `FormSheet` block (`formSheet`) renders a form-builder document with `Field`; submit is `btn btn-primary`.
