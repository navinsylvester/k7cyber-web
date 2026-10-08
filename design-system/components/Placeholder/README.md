# Placeholder
PT3, the dot field in a 1px frame with a mono caption: what stands wherever the content doc says <Image>, <Icon>, <Cover>, <Photo>, <Map> or <Animation> until the asset exists.

**Use** in every page build so missing assets are visible and named, never blank or stock. Set the aspect ratio with `--ar`. When the asset arrives, the `<img>` fills the same frame and the caption stays.

**Provide** the caption (what the asset is and where it goes) and the ratio.

**Don't** ship a placeholder to production without a ticket; the caption is the ticket.
