# Page designs

Mirror of the Design canvas https://claude.ai/artifact/KAf1PvdASMjpvpANYVpqhF ("K7 Enterprise Website Pages"), one folder per page template from `docs/page-shapes.md`. Each `.dc.html` is a Claude Design artboard: fluid markup on the K7 Design Language 2.1 classes (`design-system/components/bundle.css`) with variables from `design-system/tokens.css`. The canvas serves those two files under `ds/k7/`; the logo files are canvas uploads.

| Folder | Artboards | Template |
|---|---|---|
| `home/` | `Home.dc.html` (1440, desktop), `Home-Mobile.dc.html` (390, imports Home) | Home |
| `platform/` | `Platform.dc.html` (1440, mega menu open via the `menuOpen` tweak), `Platform-Mobile.dc.html` (390) | Platform overview |
| `product/` | `Product-MDR.dc.html` (1440), `Product-MDR-Mobile.dc.html` (390) | Product (MDR worked example; XDR/EDR/EPS and network products reuse it) |
| `addon/` | `Addon-DLP.dc.html`, `Addon-DLP-Mobile.dc.html` | Addon (DLP; the other six add-ons reuse it) |
| `industry/` | `Industry-BFSI.dc.html`, `Industry-BFSI-Mobile.dc.html` | Industry (BFSI; six more industries reuse it) |
| `service/` | `Service-GRC.dc.html`, `Service-GRC-Mobile.dc.html` | Service (GRC; the other ten services reuse it) |
| `comparison/` | `Comparison-CrowdStrike.dc.html`, `-Mobile` | Comparison (K7 vs CrowdStrike, all twelve criteria) |
| `contact/` | `Contact.dc.html`, `-Mobile` | Contact (three offices, enquiry form) |
| `form/` | `Form-Quote-XDR.dc.html`, `-Mobile` | Form (Request quote for XDR; Enquire and Request demo drop the employee count) |

`make.py` and `make2.py` generate the addon, industry, service, comparison, contact and form artboards from the shared chrome in `k7chrome.py`; `build.py` and `shoot.py` turn any artboard into a static preview and screenshot it with headless Chrome (set `K7_SCRATCH`).
