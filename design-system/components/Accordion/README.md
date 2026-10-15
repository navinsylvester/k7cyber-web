# Accordion
A ledger of expandable rows: a number, the title, and + / − at the right; the body opens beneath in `muted`.

**Use** for the home page's four capability tiles ("mouseover opens a card" becomes press to open), the Platform page's Solutions/Addons expansion, FAQs, and the comparison page's criteria on narrow screens. One open at a time.

**Provide** {title, body} rows; the body may hold a tag row or a CapabilityRow list. Number rows only when the order is informative.

**Don't** hide primary content in a closed row; the first row opens by default. No chevron icons; + and − are the affordance.

**Build** a native `details`/`summary` pair on the accordion rules in `bundle.css`; the blog table of contents and the support action panels are the same element. No page block renders it yet.
