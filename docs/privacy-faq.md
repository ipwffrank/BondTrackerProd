# Axle — Privacy & Data Protection FAQ

**Prepared by:** ZHOOZH PTE. LTD.  
**Last Updated:** April 2026  
**Applicable Frameworks:** Singapore PDPA 2012, Hong Kong PDPO (Cap. 486)

---

This document addresses frequently asked questions from institutional clients regarding how Axle handles, protects, and governs personal and organisational data. For enquiries not covered here, contact our Data Protection Officer at **info@axle-finance.com**.

---

## 1. General — Access & Governance

### Does Axle or ZHOOZH have a "backdoor" to access our data?

There is no hidden or undisclosed access mechanism. However, we want to be fully transparent about how platform-level access works.

Axle's platform administrators at ZHOOZH hold a designated **host admin** role within the system. This role exists for legitimate operational purposes: responding to support requests, investigating security incidents, assisting with account recovery, and monitoring platform health. Host admin access is:

- **Authenticated** — host admin accounts are secured with Firebase Authentication (email and password, with the same identity verification as all other users). There is no shared key or backdoor credential.
- **Audited** — all host admin actions that read or modify organisational data generate an audit log entry with a timestamp and the acting user's identity.
- **Governed** — access is restricted at the database level via Firestore security rules. Host admins can read data across organisations but cannot modify or delete data beyond what is required for operational support without explicit rules permitting it.
- **Disclosed** — this access is documented in our Privacy Policy (Section 6) and this FAQ. We do not access client data for commercial purposes, analytics, or any purpose outside of platform operations and legal obligations.

If you require a contractual undertaking on data access restrictions, please contact us to discuss a bespoke Data Processing Agreement.

---

### Who within ZHOOZH can access our organisation's data?

Only designated host administrators at ZHOOZH can access cross-organisation data at the platform level. Access is controlled by an explicit `hostAdmins` collection in our database — being an employee of ZHOOZH does not automatically grant data access. Host admin status is granted deliberately and individually.

Within your own organisation on Axle:

- **Admins** can access all organisational data, manage team members, and view audit logs.
- **Members** can access data within your organisation's workspace but cannot view audit logs, manage other users, or delete clients.
- **No cross-organisation access is technically possible** — Firestore security rules enforce strict organisation-level data isolation at the database layer, not just the application layer.

---

### Is Axle compliant with the Singapore PDPA and Hong Kong PDPO?

Yes. ZHOOZH PTE. LTD. is a Singapore-registered entity. Our platform is designed and operated in compliance with:

- **Personal Data Protection Act 2012 (PDPA)** — Singapore
- **Personal Data (Privacy) Ordinance, Cap. 486 (PDPO)** — Hong Kong

Our compliance measures include: a published Privacy Policy, consent collection at account creation, purpose limitation on data use, data subject rights (access, correction, withdrawal of consent), data retention policies, mandatory breach notification procedures under the 2021 PDPA amendments, and engagement with Data Processing Agreements with our sub-processors.

We also align our controls with the **MAS Technology Risk Management (TRM) Guidelines** and support institutional clients regulated by the **SFC (Hong Kong)** and **ASIC (Australia)**. Detailed compliance mapping documents are available on request.

---

### Who is your Data Protection Officer?

ZHOOZH PTE. LTD. has designated a Data Protection Officer (DPO) as required under Section 11(3) of the PDPA. For data access requests, correction requests, consent withdrawal, or privacy complaints, please contact:

**Data Protection Officer**  
ZHOOZH PTE. LTD.  
Email: **info@axle-finance.com**  
Website: axle-finance.com

For users in **Hong Kong**, complaints may be lodged with the Office of the Privacy Commissioner for Personal Data (PCPD): [pcpd.org.hk](https://www.pcpd.org.hk)

For users in **Singapore**, complaints may be lodged with the Personal Data Protection Commission (PDPC): [pdpc.gov.sg](https://www.pdpc.gov.sg)

---

## 2. Encryption

### How is data encrypted when users input it into Axle?

Encryption is applied at multiple layers:

**In Transit (data moving between your browser and our servers)**

All data transmitted between the Axle application and our backend is encrypted using **TLS 1.2 or higher**. All connections are enforced over HTTPS. We additionally deploy **HTTP Strict Transport Security (HSTS)**, which instructs browsers to always use encrypted connections to Axle and prevents downgrade attacks. This applies to all application endpoints and our serverless API functions.

**At Rest (data stored in our database)**

All data stored in Google Cloud Firestore is encrypted at rest using **AES-256**, managed by Google Cloud's Key Management Service (KMS) with automatic key rotation. This encryption is applied at the infrastructure level by Google and is independent of any application-level configuration. Google Cloud holds **ISO 27001, SOC 2 Type II, and PCI DSS** certifications.

**Passwords**

Axle does not store passwords. Authentication is handled entirely by **Firebase Authentication** (Google). Passwords are managed, hashed, and secured by Firebase and are never transmitted to or stored by Axle's application layer.

**Session Data and Local Cache**

When you are using Axle, a local cache of recently accessed data is maintained in your browser's IndexedDB for offline performance. This cache is automatically cleared when you log out, ensuring that no residual data remains on shared or unattended devices.

---

### Is data encrypted when it is sent to third-party services (e.g., AI transcript analysis)?

Yes, all outbound connections from our serverless functions to third-party providers use HTTPS (TLS). However, we want to be transparent about what data is shared and with whom:

| Service | Purpose | Data Sent | Encryption |
|---------|---------|-----------|-----------|
| **Google Firebase / Firestore** | Data storage and authentication | All platform data | TLS in transit, AES-256 at rest |
| **Netlify** | Application hosting and serverless functions | Request/response data | TLS |
| **OpenAI API** | AI transcript analysis (opt-in feature) | Transcript text or chat screenshots | TLS (HTTPS) |
| **Resend** | Transactional email (invitations, notifications) | Email address, invitation details | TLS |
| **OpenFIGI** | Bond identifier lookup | Bond ticker or ISIN (non-personal) | TLS |

**Regarding AI transcript analysis specifically:** When you use the AI-powered transcript analysis feature, transcript text or chat screenshots are transmitted to OpenAI's API for processing. This feature requires your **explicit consent** before first use. OpenAI processes data via API call and does not retain your data beyond the duration of the request for model training purposes. We maintain a Data Processing Agreement with OpenAI governing this processing. If you choose not to use this feature, no transcript data is sent to OpenAI.

---

### What encryption standards govern data at rest — and who holds the keys?

Data at rest in Google Cloud Firestore is encrypted using **AES-256**. Encryption keys are managed by **Google Cloud Key Management Service (KMS)** with automatic key rotation. ZHOOZH does not hold or manage these keys directly — this is managed by Google at the infrastructure level.

For clients with specific key management requirements (e.g., Customer-Managed Encryption Keys / CMEK), please contact us to discuss options. CMEK is available on Google Cloud at the project level and can be arranged for enterprise deployments.

---

## 3. Data Protection

### How do you ensure our data is protected?

Data protection at Axle operates across four layers:

**Layer 1 — Infrastructure Security**  
Our data is stored on Google Cloud, which maintains independent security certifications (ISO 27001, SOC 2 Type II, PCI DSS). Our application is hosted on Netlify, which also provides enterprise-grade infrastructure security. Both providers undergo independent third-party audits.

**Layer 2 — Access Controls**  
Firestore security rules enforce **strict organisational data isolation at the database layer**. This means that even if a bug existed in our application code, a user from one organisation could not access another organisation's data — the database itself rejects unauthorised reads and writes. Within your organisation, role-based access control (Admin / Member) further restricts what each user can do.

**Layer 3 — Application Security**  
- All serverless API functions verify the caller's Firebase Authentication identity before processing any request.
- API endpoints that perform administrative actions require additional verification against our host admin registry.
- All public-facing endpoints (e.g., demo request forms, contact forms) are rate-limited to prevent abuse.
- Cross-Origin Resource Sharing (CORS) is restricted to authorised domains only — our APIs cannot be called from arbitrary third-party websites.
- A Content Security Policy (CSP) is enforced to prevent cross-site scripting (XSS) and data injection attacks.

**Layer 4 — Audit and Accountability**  
Every action that modifies or exports data on the platform is recorded in an **immutable audit log**. Audit log entries include the acting user's identity, timestamp, and action type. Audit logs cannot be deleted or modified by any user — including platform administrators. Only organisation admins and ZHOOZH's host admins can read audit logs.

---

### Where is our data stored geographically?

By default, Axle's Firestore database is hosted on Google Cloud's **US multi-region** (`nam5`) infrastructure. For APAC institutional clients with data residency requirements — including those subject to MAS TRM Guidelines or SFC requirements — we can arrange deployment with data hosted in **asia-southeast1 (Singapore)**. Please contact us to discuss data residency options for your organisation.

All data processing by our application infrastructure (Netlify serverless functions) occurs in the US or EU depending on Netlify's edge routing. Data in transit is always encrypted (TLS) regardless of where it is processed.

---

### How long do you retain our data?

Our retention periods are:

| Data Category | Retention Period |
|---------------|-----------------|
| Account and profile data | Duration of active account + 12 months after account deletion |
| Activity and transaction records | 7 years (financial record-keeping requirements) |
| AI-processed transcript data | As specified by your organisation's data retention policy |
| Usage logs and analytics | Up to 24 months |

Upon expiry of the applicable retention period, personal data is securely deleted or irreversibly anonymised. If your organisation has a specific data retention requirement that differs from the above (e.g., shorter retention for compliance with your internal policies), please contact us.

---

### What happens to our data if we stop using Axle?

Upon account termination, we will:

1. Disable access to your organisation's workspace immediately.
2. Retain your data for up to 12 months after account deletion to allow for any final data export requests, regulatory queries, or dispute resolution.
3. After the applicable retention period, securely delete or anonymise all personal data associated with your organisation.

Before termination, authorised administrators can export your organisation's data (activities, clients, pipeline, analytics) in PDF or Excel format. You may also submit a data access request to our DPO to obtain a complete copy of your personal data.

---

### How do you handle data breaches?

We maintain a **Data Breach Response Plan** aligned with the 2021 amendments to the PDPA, which introduced mandatory breach notification obligations. In the event of a data breach:

1. We assess the breach against the PDPA's notification criteria (significant harm to affected individuals, or 500+ individuals affected).
2. If the breach meets the notification threshold, we notify the **Personal Data Protection Commission (PDPC)** within **3 calendar days** of completing our assessment.
3. We notify affected individuals without unreasonable delay where required or where the breach poses a risk of significant harm.
4. All breach incidents are recorded in our internal breach register.

For Hong Kong users, while the PDPO does not currently impose mandatory breach notification, we apply the same notification standards and follow PCPD guidance on voluntary notification.

To report a suspected security incident or vulnerability, contact: **security@axle-finance.com**

---

### What are your sub-processors and do you have Data Processing Agreements with them?

Our current sub-processors are:

| Sub-processor | Purpose | Jurisdiction | DPA Status |
|--------------|---------|-------------|-----------|
| Google (Firebase / Firestore) | Data storage, authentication | US / Global (Google Cloud) | Google Cloud DPA in place |
| Netlify | Application hosting, serverless functions | US | DPA in place |
| OpenAI | AI transcript analysis (opt-in) | US | DPA in place |
| Resend | Transactional email | US | DPA in place |
| OpenFIGI (Bloomberg) | Bond identifier lookup | US | Data is non-personal (tickers/ISINs only) |

A full sub-processor list with jurisdictions and DPA status is available on request as part of our vendor due diligence package.

---

### What are our rights as data subjects?

Depending on the jurisdiction applicable to you, you have the following rights:

| Right | Singapore (PDPA) | Hong Kong (PDPO) |
|-------|-----------------|-----------------|
| Access your personal data | Yes — response within 30 days | Yes — response within 40 days |
| Correct inaccurate data | Yes | Yes |
| Withdraw consent | Yes | Yes (for consent-based processing) |
| Opt out of direct marketing | Yes | Yes (strict opt-in required) |
| Data portability | Where required by law | Not currently mandated |
| Request deletion | Yes (subject to legal retention requirements) | Yes (subject to legal retention requirements) |

To exercise any of these rights, submit a written request to our DPO at **info@axle-finance.com**. We will verify your identity before processing any request.

---

## 4. AI Features

### Does the AI transcript analysis store or learn from our data?

No. When you use the AI-powered transcript analysis feature, your transcript data is sent to OpenAI's API for a single processing request. **OpenAI does not use API-submitted data to train its models** under our API agreement. The data is not retained by OpenAI beyond the duration of the processing request.

This feature is **opt-in and requires explicit consent** before first use. You will be informed that transcript data will be sent to a third-party AI provider before you proceed. You may withdraw your consent at any time from your account settings, which will disable the AI analysis feature for your account.

---

### What data does the AI analysis send to OpenAI?

When you paste a Bloomberg chat transcript (text) or upload a chat screenshot (image), the content of that transcript or image is transmitted to OpenAI's API for processing. This may include:

- Client company names and contact persons mentioned in the transcript
- Bond tickers, ISINs, prices, and trade details
- The content of the conversation between dealer and client

We recommend reviewing transcripts before submission and removing any content that is not relevant to the activity you wish to log. You retain full control over what you submit.

---

## 5. Vendor Due Diligence

### Can you complete our vendor due diligence questionnaire?

Yes. We actively support institutional VDD processes. Email your questionnaire to **info@axle-finance.com**. Our typical response time is **5 business days**.

We can provide:

- Sub-processor list with jurisdictions
- Data flow diagrams
- Infrastructure architecture documentation
- Compliance mapping documents (MAS TRM, SFC, ASIC)
- Penetration test report summaries (under NDA)
- Copies of relevant third-party certifications (Google Cloud ISO 27001, SOC 2)

NDA and information security agreements can be arranged prior to disclosure of sensitive documentation.

---

*This FAQ is provided for informational purposes and does not constitute legal advice. For legally binding commitments regarding data handling, please refer to our Privacy Policy and your Data Processing Agreement with ZHOOZH PTE. LTD.*

*ZHOOZH PTE. LTD. — Singapore | axle-finance.com | info@axle-finance.com*
