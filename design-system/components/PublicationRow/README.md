# PublicationRow
An IndexRow for insight: the publication-type icon, title, one-line description, the type and format in `label`, and the arrow.

**Use** for the "Insight" trio on Platform and industry pages, the Insight listing, and news, press and event listings (type becomes the date). Whitepapers and case studies that are PDFs say so in the label.

**Provide** {type (Whitepaper, Case study, Blog, News, Press release, Event), title, description, href, format or date}. Icons: Report for whitepapers, Definition for case studies, Analysis for blogs.

**Don't** show cover images in the row; a cover belongs in a FeaturePanel for the one featured item. Rows link out to blog.k7computing.com or the PDF directly.

**Payload** `insightCards` block relating to the `insights` collection.
