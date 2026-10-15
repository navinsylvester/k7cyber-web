# FeaturePanel
The one featured block of a sheet: a `panel` ground, filed (S7), its label on the tab, a media frame beside the title, copy, optional list and action. The corner is square; until 2.2 it carried a 28px chamfer.

**Use** once per sheet at most: the Platform page's animation + copy, an industry's "Solutions for X" lead card, the expanded industry on the Platform page, the AMTSO award. `is-link` when the whole panel leads somewhere (it then inverts on hover).

**Provide** the media (an asset, or a `ph` placeholder with a caption), the label for the tab (`filed` + `ftab`; without a label the panel has no tab), the title, copy, an optional bullet list and one action. Two columns from 760px.

**Don't** stack several panels in a grid; the second becomes CapabilityRow or IndexRow content. No image without a caption.
