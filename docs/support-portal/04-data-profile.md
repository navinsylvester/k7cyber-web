# Data profile of the Dynamics 365 exports

Generated 2026-10-10 by `tools/profile_exports.py` in the planning folder. Read this instead of the .xlsx files.
**Caveat on yearly volumes below:** the case and contact exports were capped at 100,000 rows and are
not a date-ordered sample; live production shows ~2,300 cases per month (see `03-metadata-summary.md`).
Use the value distributions here, not the per-year counts.
The `(Do Not Modify) <Entity>` hidden export column is the record GUID; `Row Checksum` / `Modified On` are export metadata and are omitted below.

## Entities (Dataverse logical names come from the export's hidden sheet)

| entity | view | rows | capped | columns |
|---|---|---|---|---|
| alletec_city | Active Cities | 2,200 |  | 4 |
| k7_defect | Active Defects | 76 |  | 6 |
| k7_rfe | Active RFE_s | 134 |  | 17 |
| k7_region | Active Regions | 9 |  | 2 |
| k7_state | Active States | 39 |  | 3 |
| product | All Products, Families & Bu... | 1,982 |  | 9 |
| account | My Active Accounts | 36,982 |  | 10 |
| knowledgearticle | My Active Articles | 35 |  | 9 |
| incident | My Active Cases | 100,000 | yes | 14 |
| contact | My Active Contacts | 100,000 | yes | 8 |

## Detected cross-file references (value overlap between columns)

| from column | matches key | distinct matched | ratio |
|---|---|---|---|
| alletec_city.State | k7_state.State | 37/37 | 1.0 |
| alletec_city.Region | k7_region.Name | 6/6 | 1.0 |
| k7_rfe.Product | product.Product Name - CRM | 12/12 | 1.0 |
| k7_state.Region | k7_region.Name | 6/6 | 1.0 |
| account.City | alletec_city.Name | 571/571 | 1.0 |
| contact.Account Name | account.Account Name | 8010/8063 | 0.99 |
| contact.First Name | contact.Full Name | 38616/42676 | 0.9 |
| product.Product Name - K7 | product.Product Name - CRM | 80/124 | 0.65 |
| contact.Middle Name | account.Account Name | 4/7 | 0.57 |
| contact.Middle Name | contact.Full Name | 4/7 | 0.57 |
| incident.Customer | contact.Full Name | 19243/43563 | 0.44 |
| contact.Last Name | contact.Full Name | 4363/9810 | 0.44 |
| account.Primary Contact | contact.Full Name | 672/1575 | 0.43 |
| k7_rfe.Owner | contact.Full Name | 6/17 | 0.35 |

## Per-entity column profiles

### alletec_city  —  view "Active Cities"  —  file `Active Cities 10_10_2026 13-12-26.xlsx`

Rows: 2,200
Rows by year ((Do Not Modify) Modified On): 2019: 2,058, 2020: 9, 2021: 11, 2022: 4, 2023: 1, 2024: 45, 2025: 47, 2026: 25

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Name | text | 100.0% | 2,180 | shape: Aaaaaaaa (308), Aaaaaaa (304), Aaaaaa (283), Aaaaaaaaa (252) | max len 47; PII (shapes only) |
| State | text | 100.0% | 37 | Andhra Pradesh (223); Uttar Pradesh (194); Maharashtra (191); Tamil Nadu (149); Karnataka (131); Gujarat (124); Bihar (120); Madhya Pradesh (119); Rajasthan (115); West Bengal (113); Odisha (86); Punjab (85); Kerala (75); Assam (68); Haryana (63); … +22 more | max len 22 |
| Region | text | 100.0% | 6 | North (704); South (608); East (528); West (336); Central (22); Others (2) | max len 7 |
| Tier Type | text | 100.0% | 3 | Others (2062); Non Metro (85); Metro (53) | max len 9 |

### k7_defect  —  view "Active Defects"  —  file `Active Defects 10_10_2026 13-12-13.xlsx`

Rows: 76
Rows by year (Created On): 2018: 48, 2019: 25, 2020: 3

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Defect Title | text | 100.0% | 76 | shape: Aaaaaa aa aaaaaa aaa aaa (4), Aaaa Aaaaaaa Aaaaaaaaaa  (2), Aaa aaaaaaaa Aaaaaaa aaa (2), Aaaaaa aa aaaaaa aaaaaaa (2) | max len 100; PII (shapes only) |
| Associated Case | text | 98.7% | 75 | top: Device control configuration (1); Query Timeout error while generating Thr (1); Reactivation Procedure (1) | max len 84 |
| Case No. | text | 98.7% | 75 | top: CS-40991-W9W1 (1); CS-13171-C2P7 (1); CS-09623-Q5Q8 (1) · shape AA-99999-A9A9, AA-999999-A9A9 | max len 14 |
| Defect No. | text | 100.0% | 76 | top: DF0094 (1); DF0052 (1); DF0048 (1) · shape AA9999 | max len 6 |
| YODIZ ID | text | 98.7% | 72 | top: N/A (3); BG-2941 (2); BG-3160 (1) · shape AA-9999, AA-99999 | max len 8 |
| Created On | datetime | 100.0% | 76 | top: 2019-02-11 12:57:44 (1); 2018-08-25 18:52:02 (1); 2018-08-11 10:35:57 (1) · shape 9999-99-99 99:99:99 | range 2018-06-23 → 2020-06-27 |

### k7_rfe  —  view "Active RFE_s"  —  file `Active RFE's 10_10_2026 13-11-58.xlsx`

Rows: 134
Rows by year (Created On): 2018: 1, 2019: 47, 2020: 30, 2021: 28, 2022: 25, 2023: 1, 2024: 1, 2025: 1

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| RFE No. | text | 100.0% | 134 | top: RF0224 (1); RF0223 (1); RF0222 (1) · shape AA9999 | max len 6 |
| RFE Title | text | 100.0% | 134 | shape: Aaaaaaaaa aa aaaaaaaaa a (2), Aaaaaa Aaaaaaaaa Aaaaaaa (2), Aaaaaaaa aaaaaaaaaa aaa  (2), Aaaaaaaaa aaa aaaaaaaaa  (2) | max len 99; PII (shapes only) |
| Created On | datetime | 100.0% | 134 | top: 2025-07-03 15:48:28 (1); 2024-12-12 12:42:26 (1); 2023-07-21 11:30:34 (1) · shape 9999-99-99 99:99:99 | range 2018-11-01 → 2025-07-03 |
| Owner | text | 100.0% | 17 | Shijas KI (43); Ajay Kumar (20); Vinay Raj (18); Anurag Gupta (12); Ganesh R (9); Tarique A (7); Sourav Nagpal (6); Jitesh Kumar (3); Prem Sai (3); Soumya Chandra aich (3); SUDARSAN RANGANATHAN (2); Daniel Devarapalli (2); Amit Kumar (2); KIRAN S (1); Rishabh Vijaywargiya (1); … +2 more | max len 21 |
| Account | empty | 0.0% | 0 |  |  |
| Number of Users | int | 48.5% | 26 | 200 (11); 400 (8); 1850 (5); 250 (4); 5000 (3); 10 (3); 7500 (3); 1000 (2); 1600 (2); 150 (2); 210 (2); 1500 (2); 2500 (2); 300 (2); 350 (2); … +11 more | range 1 → 7500 |
| Associated Case | text | 73.1% | 55 | top: POC of EPS at M/s.HAL-ACD (8); Installation of K7 Cloud Endpoint Securi (6); POC of K7 Enterprise Security | VSSC (6) | max len 86 |
| Associated CaseNo. | text | 78.4% | 59 | top: CS-170914-J9L7 (8); CS-71339-V1B9 (6); CS-68413-F6P1 (6) · shape AA-999999-A9A9, AA-99999-A9A9 | max len 14 |
| Associated Opportunity No. | text | 41.8% | 35 | EPS for HAL (8); Opex Model (4); 1000 User Cloud @ Vuram (3); Kerry Indev Logistics Private Limited (3); The Hans Foundation Hospital (2); Fresh 2500U EPS Popular Vehicles (2); Fresh 10U - Spacextended (2); 40 User EPS @ Olive Downtown (2); EPS @ Max Value, Thrissur (2); EPS E Care (2); Riversand Technologies India Private Lim (2); Renewal with Additional 3250U1Y- REVA (1); 5000 user fresh (1); EPS fresh 500 Alliance University (1); Toyo Ink - UTM (1); … +20 more | max len 63 |
| Customer Type | text | 99.3% | 4 | Potential Customer (88); Existing Customer (33); New Customer (6); Enterprise Sales Team (6) | max len 21 |
| Product | text | 95.5% | 12 | Enterprise Security (91); Cloud Security (17); ES - Adv - 100 to 249U - 3 Y (8); UTM (3); Total Security - 1U1Y (2); Mobile Security - 1U1Y (1); AAA - Office (1); Business Security (1); ES - Adv - 100 to 249 U - 1Y (1); ES - Adv - 1000+ U - 3Y (1); ES - Adv - 100 to 249 U - 3Y (1); CS - Adv - 100 to 249 U - 3Y (1) | max len 28 |
| Vertical Type | text | 99.3% | 3 | Enterprise (129); Consumer (3); Business Security (1) | max len 17 |
| YODIZ ID | text | 40.3% | 52 | top: US-3483 (2); US-3288 (2); US-3983 (1) · shape AA-9999, AA-999 | max len 7 |
| RFE Received From | text | 100.0% | 5 | Customer (104); Potential (18); Enterprise Team (6); Partner (3); Support (3) | max len 15 |
| RFE Type | text | 100.0% | 3 | Customer RFE (110); Pre Sales (20); Support RFE (4) | max len 12 |
| RFE Status | text | 100.0% | 2 | Open (132); Status for Principle Support (2) | max len 28 |
| RFE Mode | text | 100.0% | 2 | Call (109); Email (25) | max len 5 |

### k7_region  —  view "Active Regions"  —  file `Active Regions 10_10_2026 13-13-02.xlsx`

Rows: 9
Rows by year (Created On): 2018: 5, 2019: 1, 2025: 1, 2026: 2

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Name | text | 100.0% | 8 | North (2); Central (1); East (1); Middle East (1); Others (1); ROW (1); South (1); West (1) | max len 11 |
| Created On | datetime | 100.0% | 9 | 2019-10-28 23:19:38 (1); 2018-05-17 16:36:21 (1); 2026-09-25 16:45:09 (1); 2018-05-17 16:36:07 (1); 2025-10-15 16:36:05 (1); 2018-08-17 17:14:20 (1); 2026-09-25 16:45:20 (1); 2018-05-17 16:36:45 (1); 2018-05-17 16:36:38 (1) | range 2018-05-17 → 2026-09-25 |

### k7_state  —  view "Active States"  —  file `Active States 10_10_2026 13-12-38.xlsx`

Rows: 39
Rows by year ((Do Not Modify) Modified On): 2019: 30, 2020: 8, 2026: 1

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| State | text | 100.0% | 39 | Andaman & Nicobar (UT) (1); Andhra Pradesh (1); Arunachal Pradesh (1); Assam (1); Bihar (1); Chandigarh (UT) (1); Chhattisgarh (1); Dadar and Nagar (UT) (1); Daman & Diu (UT) (1); Delhi (UT) (1); Goa (1); Gujarat (1); Haryana (1); Himachal Pradesh (1); Jammu and Kashmir (1); … +24 more | max len 22 |
| Region | text | 100.0% | 6 | East (13); North (10); South (7); West (6); Central (2); Others (1) | max len 7 |
| Country | text | 100.0% | 2 | India (38); United States (1) | max len 13 |

### product  —  view "All Products, Families & Bu..."  —  file `All Products, Families & Bundles 10_10_2026 13-11-32.xlsx`

Rows: 1,982
Rows by year ((Do Not Modify) Modified On): 2018: 26, 2019: 12, 2020: 47, 2021: 4, 2022: 2, 2023: 18, 2024: 59, 2025: 90, 2026: 1,724

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Product Name - CRM | text | 100.0% | 794 | shape: A9 AAA-A Aaaaaa-A9AA9999 (80), AA - Aaa - 999 aa 999A - (72), A9 AAA-A Aaaaaa-A9AA999- (32), AA - Aaa - 9999 aa 9999A (30) | max len 59; PII (shapes only) |
| Product ID | text | 100.0% | 1,982 | top: K7Sales159 (1); K7Sales158 (1); K7Sales157 (1) | max len 31 |
| Product Name - K7 | text | 98.0% | 125 | shape: AA - Aaa - 999 aa 999A - (19), AA - Aaa - 9999 aa 9999A (12), Aaaaaaaaaa Aaaaaaaa Aaaa (9), Aaaaaaaaaa Aaaaa Aaaaaaa (7) | max len 101; PII (shapes only) |
| Additional Information | text | 98.0% | 5 | Corporate (1403); Education (390); Educational (144); Hotel (3); Office (2) | max len 11 |
| HSN Code | text | 96.6% | 6 | 997331 (1726); 85175093 (110); 998313 (72); - (3); 0 (2); 999293 (1) | max len 8 |
| No. of Users | text | 97.9% | 70 | top: >5000 (153); 500-999 (123); 100-249 (120) | max len 13 |
| No. of Years | int | 98.0% | 8 | 1 (742); 3 (707); 5 (449); 2 (40); 6 (1); 4 (1); 32 (1); 20 (1) | range 1 → 32 |
| Status | text | 100.0% | 4 | Retired (1022); Active (957); Draft (2); Under Revision (1) | max len 14 |
| Product Structure | text | 100.0% | 2 | Product (1980); Product Family (2) | max len 14 |

### account  —  view "My Active Accounts"  —  file `My Active Accounts 10_10_2026 13-07-06.xlsx`

Rows: 36,982
Rows by year (Created On): 2018: 16,129, 2019: 4,025, 2020: 8,076, 2021: 2,654, 2022: 1,388, 2023: 1,122, 2024: 1,239, 2025: 1,128, 2026: 1,221

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Created On | datetime | 100.0% | 19,360 | top: 2018-06-07 13:09:53 (34); 2018-06-07 13:02:53 (33); 2018-06-07 13:03:19 (33) · shape 9999-99-99 99:99:99 | range 2018-06-07 → 2026-10-10 |
| Account Name | text | 100.0% | 30,581 | shape: Aaaaaa (690), Aaaaaaa (642), Aaaaa (513), Aaaaaaaa (504) | max len 160; PII (shapes only) |
| Account ID | text | 53.9% | 19,926 | top: ACC-1911-03140 (2); ACC-2402-19867 (2); ACC-2001-04905 (2) · shape AAA-9999-99999 | max len 14 |
| Account Type | text | 54.9% | 5 | Customer (14095); Partner (5881); To be Decided (251); Distributor (65); MSP (6) | max len 13 |
| Account Sub Type | text | 33.5% | 2 | Customer (10871); Partner (1509) | max len 8 |
| Primary Contact | text | 5.2% | 1,597 | shape: Aaaaaa (112), Aaaaa (80), Aaaaaaa (76), Aaaaaa Aaaaa (65) | max len 59; PII (shapes only) |
| Main Phone | text | 2.6% | 961 | shape: 9999999999 (592), 99999999999 (134), 999 99999999 (63), 9999 9999999 (53) | max len 30; PII (shapes only) |
| Mobile No. | text | 92.9% | 31,748 | shape: 9999999999 (31666), 999999999 (34), 99999999999 (8), +999 9 999 9999 (8) | max len 18; PII (shapes only) |
| City | text | 42.4% | 571 | top: Chennai (2615); Bangalore (1084); Delhi (654) | max len 19 |
| Life Cycle Stage | text | 29.6% | 8 | Subscriber (3966); Customer (2357); Opportunity (1747); Lead (1121); Others (626); Evangelist (579); Marketing Qualified Lead (291); Sales Qualified Lead (243) | max len 24 |

### knowledgearticle  —  view "My Active Articles"  —  file `My Active Articles 10_10_2026 13-11-15.xlsx`

Rows: 35
Rows by year ((Do Not Modify) Modified On): 2018: 3, 2020: 2, 2021: 1, 2026: 29

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Article Public Number | text | 100.0% | 32 | KA-01002 (2); KA-01001 (2); KA-01000 (2); KA-01059 (1); KA-01056 (1); KA-01054 (1); KA-01048 (1); KA-01039 (1); KA-01060 (1); KA-01044 (1); KA-01053 (1); KA-01035 (1); KA-01051 (1); KA-01037 (1); KA-01045 (1); … +17 more | max len 8 |
| Title | text | 100.0% | 32 | A critical error has occurred while tryi (2); Activation (2); Unable to install K7 due to the presence (2); Account Access – Login / Password Reset (1); Billing Issue – Unexpected Charges / Hig (1); Cancel Service – Termination (1); Creating Custom Bouquets (1); Damaged or Wilted Flowers (1); Data Usage Inquiry – Balance Check (1); Delayed Delivery Compensation (1); Device Troubleshooting – Connectivity /  (1); How to Check the Status of a Shipped Ord (1); How to place an order for the latest iph (1); How to Place order for flowers (1); How to Raise a Refund Request with Conto (1); … +17 more | max len 117 |
| Status | text | 100.0% | 2 | Draft (32); Published (3) | max len 9 |
| Creation Mode | text | 82.9% | 1 | Manual (29) | max len 6 |
| Major Version Number | int | 100.0% | 2 | 0 (32); 1 (3) | range 0 → 1 |
| Minor Version Number | int | 100.0% | 1 | 0 (35) | range 0 → 0 |
| Knowledge Article Views | int | 100.0% | 4 | 0 (29); 5 (2); 2 (2); 31 (2) | range 0 → 31 |
| Modified On | datetime | 100.0% | 30 | 2020-11-30 15:23:08 (2); 2026-07-28 04:47:09 (2); 2026-07-28 04:46:45 (2); 2026-07-28 04:46:54 (2); 2026-07-28 04:46:58 (2); 2026-07-28 04:47:11 (1); 2018-05-17 16:36:15 (1); 2018-05-17 16:32:43 (1); 2026-07-28 04:47:07 (1); 2026-07-28 04:46:59 (1); 2026-07-28 04:46:49 (1); 2026-07-28 04:47:13 (1); 2026-07-28 04:46:55 (1); 2026-07-28 04:47:06 (1); 2026-07-28 04:47:02 (1); … +15 more | range 2018-04-02 → 2026-07-28 |
| Language | text | 100.0% | 1 | English - United States (35) | max len 23 |

### incident  —  view "My Active Cases"  —  file `My Active Cases 10_10_2026 13-10-21.xlsx`

Rows: 100,000  **(hit the 100,000-row export cap; true count unknown)**
Rows by year (Created On): 2018: 10,291, 2019: 14,166, 2020: 15,189, 2021: 15,158, 2022: 10,637, 2023: 12,499, 2024: 8,525, 2025: 8,106, 2026: 5,429

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Case Title | text | 100.0% | 33,093 | shape: AA-999999-A9A9 (505), Aaaaaaaaaa aaaaa - Aaaaa (496), AA-99999-A9A9 (482), Aaaaaaaaaaaa aaaaa - Aaa (247) | max len 200; PII (shapes only) |
| Case Number | text | 100.0% | 99,998 | top: CS-388750-Y3C1 (2); CS-121079-K9M6 (1); CS-66582-S2Y7 (1) · shape AA-999999-A9A9, AA-99999-A9A9 | max len 16 |
| Customer | text | 100.0% | 45,753 | shape: Aaaaaa (1492), Aaaaaaa (1350), Aaaaaa Aaaaa (1310), Aaaaaaaa (1172) | max len 77; PII (shapes only) |
| Created On | datetime | 100.0% | 99,661 | top: 2024-03-29 21:36:24 (5); 2024-06-24 21:31:19 (4); 2024-06-23 23:06:29 (4) · shape 9999-99-99 99:99:99 | range 2018-06-11 → 2026-10-10 |
| Created By | text | 100.0% | 58 | top: K7 Computing (16487); Abeed Shaik (11228); Mohamed Althaf (9956) | max len 22 |
| Assign Date | datetime | 4.9% | 4,871 | top: 2020-08-07 09:51:29 (1); 2018-08-02 13:31:02 (1); 2025-04-15 17:24:58 (1) · shape 9999-99-99 99:99:99 | range 2018-06-15 → 2026-10-10 |
| Case Considered as | text | 99.0% | 2 | FCR (70760); Non-FCR (28285) | max len 7 |
| Customer Type | text | 99.9% | 13 | Existing Customer (84442); Dealer/Reseller (8110); Consumer Sales Team (2462); Partner (1618); New Customer (1414); Potential Customer (1066); Enterprise Sales Team (597); Large Enterprise (500+) (120); Pro32 Team (35); Compuage Sales team (6); Special campaign-HDFC (2); Virus Hunter (2); Malware Fox (2) | max len 23 |
| Escalated On | empty | 0.0% | 0 |  |  |
| Follow Up By | empty | 0.0% | 0 |  |  |
| Modified By | text | 100.0% | 51 | top: SYSTEM (59756); K7 Computing (36625); Anif Veermani (462) | max len 22 |
| Modified On | datetime | 100.0% | 74,257 | top: 2023-09-05 09:28:09 (8); 2022-10-03 16:43:41 (7); 2022-10-03 07:58:01 (7) · shape 9999-99-99 99:99:99 | range 2018-07-06 → 2026-10-10 |
| Source of Ticket | text | 100.0% | 7 | Phone (78999); Email (19005); Chat (1619); Web (359); Mobile App (5); Twitter (5); Facebook (2) | max len 10 |
| Status Reason | text | 100.0% | 9 | Closed-Call (91690); Closed-Remote (5010); Merged (3184); Canceled (83); In Progress-Customer (19); In Progress-Principle Support (10); Reassigned (2); Open (1); In Progress-Lab (1) | max len 29 |

### contact  —  view "My Active Contacts"  —  file `My Active Contacts 10_10_2026 13-08-42.xlsx`

Rows: 100,000  **(hit the 100,000-row export cap; true count unknown)**
Rows by year ((Do Not Modify) Modified On): 2018: 10,869, 2019: 12,170, 2020: 16,190, 2021: 13,967, 2022: 12,444, 2023: 9,928, 2024: 9,771, 2025: 8,904, 2026: 5,757

| column | type | filled | distinct | values / samples | notes |
|---|---|---|---|---|---|
| Full Name | text | 99.8% | 56,857 | shape: Aaaaaa (1581), Aaaaaa Aaaaa (1441), Aaaaaaa (1438), Aaaaa Aaaaa (1415) | max len 81; PII (shapes only) |
| First Name | text | 96.1% | 46,281 | shape: Aaaaaa (2053), Aaaaaaa (1812), Aaaaa (1688), Aaaaaaaa (1585) | max len 50; PII (shapes only) |
| Middle Name | text | 0.0% | 7 | Kumar (3); Singh (1); Vasanth and Co (1); Lal (1); Ranjan (1); Kishor (1); Anantha (1) | max len 14 |
| Last Name | text | 19.4% | 10,707 | shape: Aaaaaa (948), Aaaaa (851), Aaaaaaa (701), Aaaaaaaa (491) | max len 50; PII (shapes only) |
| Account Name | text | 70.5% | 8,132 | shape: Aaaaaa Aaaaaaaa (60), Aaaaaaaa (54), AAAA (51), Aaaaaa (47) | max len 93; PII (shapes only) |
| Mobile Phone | text | 89.0% | 86,548 | shape: 9999999999 (85985), 99999999999 (162), 999999999 (57), 999 99999999 (44) | max len 26; PII (shapes only) |
| Business Phone | text | 6.7% | 6,681 | shape: 9999999999 (5818), 99999999999 (498), 9999999999 & 9999999999 (36), 999999999999 (30) | max len 50; PII (shapes only) |
| Email | text | 97.8% | 94,335 | shape: aaaaaaaaaaa@aaaaa.aaa (2308), aaaaaaaaaaaa@aaaaa.aaa (2291), aaaaaaaaaa@aaaaa.aaa (2167), aaaaaaaaaaaaa@aaaaa.aaa (2146) | max len 76; PII (shapes only) |
