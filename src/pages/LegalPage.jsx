import React from 'react';
import { useParams, Link } from 'react-router-dom';
import MarketingNav from '../components/marketing/MarketingNav';
import MarketingFooter from '../components/marketing/MarketingFooter';

// ─── Privacy Policy ─────────────────────────────────────────────────────────────
const PrivacyPolicy = () => (
  <>
    <h1>Privacy Policy</h1>
    <p className="legal-meta">Last Updated: 16 March 2026</p>

    <h2>1. Introduction</h2>
    <p>Bridge Logic LP ("Bridge Logic", "we", "us", "our") is committed to protecting and respecting your privacy. Bridge Logic is a company registered in Singapore and is the owner and operator of the Axle platform at axle-finance.com (the "Platform"). This Privacy Policy is issued in compliance with the Personal Data Protection Act 2012 of Singapore ("PDPA"), the Personal Data (Privacy) Ordinance (Cap. 486) of the Laws of Hong Kong ("PDPO"), and other applicable data protection laws in the jurisdictions in which we operate.</p>
    <p>This Privacy Policy explains how we collect, use, store, disclose, and protect your personal data when you access or use the Platform.</p>
    <p>By accessing or using the Platform, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with the practices described herein, please do not use the Platform.</p>

    <h2>2. Data Controller</h2>
    <p>Bridge Logic is the data controller responsible for the personal data collected through the Platform. For any enquiries regarding this Privacy Policy or your personal data, please contact our Data Protection Officer at the contact details provided in Section 15 of this Policy.</p>

    <h2>3. Personal Data We Collect</h2>
    <p>We may collect and process the following categories of personal data:</p>

    <h3>3.1 Information You Provide Directly</h3>
    <ul>
      <li>Full name and email address (for account registration and authentication)</li>
      <li>Organisation name, role, and position</li>
      <li>Login credentials (passwords are stored in encrypted form only)</li>
      <li>Communication records, including transcript uploads, client interaction notes, and correspondence with us</li>
    </ul>

    <h3>3.2 Information Collected Automatically</h3>
    <ul>
      <li>Device information (browser type, operating system, device identifiers)</li>
      <li>Usage data (pages visited, features used, session duration, clickstream data)</li>
      <li>IP address and approximate geographic location</li>
      <li>Cookies and similar tracking technologies (see Section 10 below)</li>
    </ul>

    <h3>3.3 Information from Third Parties</h3>
    <ul>
      <li>Organisation administrators may provide your details for team account setup</li>
      <li>Authentication data from third-party sign-in providers (e.g., Google)</li>
    </ul>

    <h2>4. Purpose of Data Collection</h2>
    <p>In accordance with Data Protection Principle 1 (DPP1) and Data Protection Principle 3 (DPP3) of the PDPO, and the purposes requirement under the PDPA, we collect and use your personal data for the following purposes:</p>
    <ol>
      <li>Account creation, authentication, and access management</li>
      <li>Providing, operating, maintaining, and improving the Platform and its features</li>
      <li>Processing and analysing uploaded transcripts and documents using artificial intelligence technology</li>
      <li>Generating analytics, reports, leaderboards, pipeline tracking, and other business insights</li>
      <li>Communicating with you regarding your account, platform updates, technical support, or service-related notices</li>
      <li>Ensuring platform security, detecting fraud, and preventing unauthorised access</li>
      <li>Complying with legal and regulatory obligations under the laws of Singapore, the Hong Kong Special Administrative Region ("HKSAR"), and other applicable jurisdictions</li>
    </ol>
    <p>We will not use your personal data for purposes beyond those stated above without obtaining your prior voluntary consent, unless required or authorised by law.</p>

    <h2>5. Legal Basis for Processing</h2>
    <p>We process your personal data based on one or more of the following legal bases:</p>
    <ul>
      <li><strong>Contractual necessity:</strong> to provide the services you have requested through the Platform</li>
      <li><strong>Legitimate interest:</strong> to improve, secure, and optimise the Platform</li>
      <li><strong>Legal obligation:</strong> to comply with applicable laws, regulations, and regulatory requirements in Singapore, Hong Kong, and other relevant jurisdictions</li>
      <li><strong>Consent:</strong> where you have given voluntary and informed consent for specific processing activities</li>
    </ul>

    <h2>6. Data Sharing and Disclosure</h2>
    <p>We may share your personal data with the following categories of recipients:</p>
    <ul>
      <li><strong>Authorised personnel within your organisation</strong> (e.g., team administrators viewing team activity and reports)</li>
      <li><strong>Cloud service providers</strong> (e.g., Google Firebase/Firestore for data hosting; Netlify for application hosting and serverless functions)</li>
      <li><strong>AI processing services</strong> (e.g., OpenAI for transcript analysis — data is processed via API call and is not retained by the AI provider beyond the duration of the request)</li>
      <li><strong>Professional advisers</strong> (e.g., lawyers, auditors, and insurers where reasonably necessary)</li>
      <li><strong>Legal authorities</strong> when required by law, regulation, court order, or governmental request</li>
    </ul>
    <p>We do not sell, rent, or trade your personal data to any third parties for marketing or advertising purposes. All third-party service providers engaged by us are contractually bound to protect your data and to use it only for the purposes specified by us.</p>

    <h2>7. Cross-Border Data Transfer</h2>
    <p>Your personal data may be transferred to and processed in jurisdictions outside Singapore and Hong Kong, including but not limited to the United States, where certain cloud service and AI providers operate. We take proactive measures to ensure adequate protection of your data during international transfers, including:</p>
    <ul>
      <li>Assessing whether recipient jurisdictions maintain comparable data protection standards</li>
      <li>Implementing contractual safeguards with overseas service providers, including Data Processing Agreements</li>
      <li>Applying encryption and security measures to data both in transit and at rest</li>
      <li>Complying with the PDPA's data transfer requirements and monitoring guidance from the Personal Data Protection Commission of Singapore ("PDPC") and the Office of the Privacy Commissioner for Personal Data, Hong Kong ("PCPD")</li>
    </ul>

    <h2>8. Data Retention</h2>
    <p>We retain your personal data only for as long as necessary to fulfil the purposes for which it was collected, or as required by applicable law. Our retention periods are as follows:</p>
    <table>
      <thead>
        <tr><th>Data Category</th><th>Retention Period</th></tr>
      </thead>
      <tbody>
        <tr><td>Account data</td><td>Duration of active account + 12 months after account deletion</td></tr>
        <tr><td>Transaction and activity records</td><td>7 years (financial record-keeping requirements)</td></tr>
        <tr><td>AI-processed transcript data</td><td>As specified by your organisation's data retention policy</td></tr>
        <tr><td>Usage logs and analytics</td><td>Up to 24 months for platform improvement purposes</td></tr>
      </tbody>
    </table>
    <p>Upon expiry of the applicable retention period, personal data will be securely deleted or irreversibly anonymised.</p>

    <h2>9. Data Security</h2>
    <p>We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. These measures include:</p>
    <ul>
      <li>Encryption of data in transit (TLS/SSL) and at rest</li>
      <li>Firebase Authentication with secure token management</li>
      <li>Role-based access controls within the Platform</li>
      <li>Regular security reviews, monitoring, and vulnerability assessments</li>
      <li>Restricted staff access to personal data on a need-to-know basis</li>
      <li>Data Processing Agreements with all third-party service providers</li>
    </ul>
    <p>While we strive to use commercially acceptable means to protect your personal data, no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.</p>

    <h2>10. Cookies and Tracking Technologies</h2>
    <p>The Platform uses cookies and similar technologies to enhance your user experience and to gather usage analytics. The categories of cookies we use are:</p>
    <ul>
      <li><strong>Essential cookies:</strong> Required for authentication, session management, and core Platform functionality. These cookies are necessary for the Platform to operate and cannot be disabled.</li>
      <li><strong>Analytics cookies:</strong> Used to understand usage patterns, measure Platform performance, and improve the user experience.</li>
    </ul>
    <p>Cookies used by the Platform are not linked to personally identifiable information beyond session management. You may configure your browser settings to reject or delete cookies; however, doing so may affect the functionality of the Platform.</p>

    <h2>11. Your Rights</h2>
    <p>Depending on the jurisdiction applicable to you, you may have the following rights regarding your personal data:</p>

    <h3>11.1 Right of Access</h3>
    <p>You may request access to your personal data held by us. Under the PDPO, we will respond within 40 days of receiving your request. Under the PDPA, we will respond within 30 days. A reasonable fee may be charged to cover the cost of complying with a data access request.</p>

    <h3>11.2 Right of Correction</h3>
    <p>You may request correction of any inaccurate personal data held by us. We will make the requested corrections within the timeframes prescribed by applicable law.</p>

    <h3>11.3 Right to Withdraw Consent</h3>
    <p>Where processing of your personal data is based on your consent, you may withdraw that consent at any time by contacting us using the details in Section 15. Please note that withdrawal of consent may affect our ability to provide certain services to you.</p>

    <h3>11.4 Right to Opt-Out of Direct Marketing</h3>
    <p>You may opt out of receiving direct marketing communications at any time by contacting us or using the unsubscribe mechanism provided in our communications.</p>

    <h3>11.5 Right to Data Portability (where applicable)</h3>
    <p>Where required by applicable law, you may request a copy of your personal data in a commonly used, machine-readable format.</p>

    <p>To exercise any of the above rights, please submit a written request to our Data Protection Officer at the contact details set out in Section 15 below.</p>

    <h2>12. Children's Privacy</h2>
    <p>The Platform is not intended for use by individuals under the age of 18. We do not knowingly collect personal data from minors. If we become aware that we have inadvertently collected personal data from a person under 18, we will take reasonable steps to delete such data promptly.</p>

    <h2>13. Third-Party Links</h2>
    <p>The Platform may contain links to third-party websites or services that are not operated or controlled by Bridge Logic. This Privacy Policy does not apply to such third-party services. We encourage you to review the privacy policies of any third-party websites you visit. Bridge Logic is not responsible for the content, privacy practices, or security of any third-party websites.</p>

    <h2>14. Changes to This Privacy Policy</h2>
    <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. Where material changes are made, we will notify you via the Platform or by email to the address associated with your account. Your continued use of the Platform after any changes to this Privacy Policy constitutes your acceptance of the revised policy. We encourage you to review this Privacy Policy periodically.</p>

    <h2>15. Contact Information</h2>
    <p>For enquiries, data access requests, data correction requests, or complaints regarding this Privacy Policy or our data practices, please contact:</p>
    <p><strong>Data Protection Officer</strong><br />Bridge Logic LP<br />Email: <a href="mailto:info@axle-finance.com">info@axle-finance.com</a><br />Website: axle-finance.com</p>
    <p>For users in Hong Kong, you may also lodge a complaint with the Office of the Privacy Commissioner for Personal Data (PCPD) at <a href="https://www.pcpd.org.hk" target="_blank" rel="noopener noreferrer">https://www.pcpd.org.hk</a>.</p>
    <p>For users in Singapore, you may contact the Personal Data Protection Commission (PDPC) at <a href="https://www.pdpc.gov.sg" target="_blank" rel="noopener noreferrer">https://www.pdpc.gov.sg</a>.</p>

    <p className="legal-effective"><em>This Privacy Policy is effective as of 16 March 2026.</em></p>
  </>
);

// ─── Terms of Service ────────────────────────────────────────────────────────────
const TermsOfService = () => (
  <>
    <h1>Terms of Service</h1>
    <p className="legal-meta">Last Updated: 16 March 2026</p>

    <h2>1. Acceptance of Terms</h2>
    <p>By accessing, browsing, or using the Axle platform at axle-finance.com (the "Platform"), you ("User", "you", "your") acknowledge that you have read, understood, and agree to be bound by these Terms of Service ("Terms"). The Platform is owned and operated by Bridge Logic LP ("Bridge Logic", "we", "us", "our"), a company registered in Singapore.</p>
    <p>If you do not agree to these Terms, you must not access or use the Platform.</p>
    <p>Bridge Logic reserves the right to modify, amend, or update these Terms at any time. Changes will be effective upon posting to the Platform. Your continued use of the Platform after any modifications constitutes acceptance of the revised Terms.</p>

    <h2>2. Eligibility</h2>
    <p>By using the Platform, you represent and warrant that:</p>
    <ul>
      <li>You are at least 18 years of age;</li>
      <li>You have the legal capacity and authority to enter into a binding agreement;</li>
      <li>You are accessing the Platform on behalf of yourself or an organisation that has authorised you to accept these Terms; and</li>
      <li>Your use of the Platform does not violate any applicable law or regulation.</li>
    </ul>

    <h2>3. Description of Services</h2>
    <p>Bridge Logic provides the Axle platform, a cloud-based solution for bond trading activity tracking, client relationship management, pipeline management, analytics, and AI-powered transcript analysis for financial services professionals (the "Services"). The Platform is designed as a productivity and information management tool for use by authorised institutional users.</p>
    <p>The Services are provided for informational and operational purposes only. The Platform does not execute, settle, or facilitate any securities transactions, nor does it provide custody of any financial instruments or client funds.</p>

    <h2>4. Account Registration and Security</h2>
    <h3>4.1 Account Creation</h3>
    <p>Access to the Platform requires registration through an invitation from an organisation administrator or through direct sign-up. You agree to provide accurate, current, and complete information during the registration process and to update such information as necessary.</p>

    <h3>4.2 Account Security</h3>
    <p>You are responsible for maintaining the confidentiality of your login credentials and for all activities conducted under your account. You agree to notify Bridge Logic immediately of any unauthorised use of your account or any other breach of security. Bridge Logic shall not be liable for any loss or damage arising from your failure to protect your account credentials.</p>

    <h3>4.3 Account Termination</h3>
    <p>Bridge Logic reserves the right to suspend or terminate your account at any time, with or without notice, if we reasonably believe that you have violated these Terms, engaged in fraudulent or unlawful activity, or if your continued access poses a risk to the Platform or other users.</p>

    <h2>5. Acceptable Use</h2>
    <p>You agree that you will not:</p>
    <ul>
      <li>Use the Platform for any unlawful, fraudulent, or malicious purpose;</li>
      <li>Attempt to gain unauthorised access to any part of the Platform, other user accounts, or any systems or networks connected to the Platform;</li>
      <li>Interfere with, disrupt, or place an unreasonable burden on the Platform or its infrastructure;</li>
      <li>Use any automated means (including bots, scrapers, or crawlers) to access or collect data from the Platform without our prior written consent;</li>
      <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Platform;</li>
      <li>Copy, reproduce, distribute, republish, or create derivative works from any content on the Platform without prior written authorisation;</li>
      <li>Upload or transmit any content that is defamatory, obscene, harmful, or that infringes the rights of any third party;</li>
      <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity;</li>
      <li>Use the Platform to transmit any unsolicited commercial communications or spam; or</li>
      <li>Circumvent or attempt to circumvent any security measures or access controls of the Platform.</li>
    </ul>

    <h2>6. Intellectual Property</h2>
    <h3>6.1 Bridge Logic's Intellectual Property</h3>
    <p>All content, materials, features, functionality, software, code, trademarks, logos, trade names (including the "Axle" name and brand), and other intellectual property on or related to the Platform are the exclusive property of Bridge Logic or its licensors and are protected under applicable intellectual property laws of Singapore and international treaties. Nothing in these Terms grants you any right, title, or interest in any such intellectual property.</p>

    <h3>6.2 User Content</h3>
    <p>By uploading, submitting, or transmitting any content to the Platform (including transcripts, notes, and other data) ("User Content"), you grant Bridge Logic a non-exclusive, worldwide, royalty-free licence to use, process, store, and display such User Content solely for the purpose of providing and improving the Services. You represent and warrant that you have all necessary rights to submit such User Content and that it does not infringe any third-party rights.</p>
    <p>You retain ownership of your User Content. Bridge Logic does not claim ownership of any content you submit to the Platform.</p>

    <h2>7. AI-Powered Features</h2>
    <p>The Platform utilises artificial intelligence ("AI") technologies, including third-party AI services, to analyse transcripts and generate insights, summaries, and recommendations. You acknowledge and agree that:</p>
    <ul>
      <li>AI-generated outputs are provided for informational and reference purposes only;</li>
      <li>Bridge Logic does not guarantee the accuracy, completeness, or reliability of any AI-generated content;</li>
      <li>You are solely responsible for independently verifying any AI-generated output before relying on it for business, financial, or operational decisions;</li>
      <li>Transcript data submitted for AI analysis is processed via API calls to third-party AI providers and is not retained by such providers beyond the duration of the processing request; and</li>
      <li>AI-generated content does not constitute financial, investment, legal, or professional advice.</li>
    </ul>

    <h2>8. No Financial or Investment Advice</h2>
    <p>Nothing on the Platform shall be construed as financial, investment, legal, tax, or other professional advice. The Platform provides tools for tracking, managing, and analysing bond trading activity and client relationships for informational purposes only. Bridge Logic is not a licensed financial adviser, broker, dealer, or investment manager, and does not provide recommendations on the purchase, sale, or holding of any securities or financial instruments.</p>
    <p>Users should seek independent professional advice from appropriately qualified and licensed professionals before making any financial or investment decisions.</p>

    <h2>9. Third-Party Links and Services</h2>
    <p>The Platform may contain links to third-party websites, services, or resources that are not owned or controlled by Bridge Logic. We do not endorse, monitor, or assume any responsibility for the content, privacy policies, practices, or availability of any third-party services. Your interaction with any third-party service is governed by that third party's own terms and policies, and is at your sole risk.</p>

    <h2>10. Disclaimer of Warranties</h2>
    <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE PLATFORM AND SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</strong></p>
    <p><strong>BRIDGE LOGIC DOES NOT WARRANT THAT: THE PLATFORM WILL BE AVAILABLE AT ALL TIMES, UNINTERRUPTED, OR ERROR-FREE; THE PLATFORM WILL BE SECURE OR FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS; THE RESULTS OBTAINED FROM THE USE OF THE PLATFORM WILL BE ACCURATE, RELIABLE, OR COMPLETE; OR ANY DEFECTS OR ERRORS IN THE PLATFORM WILL BE CORRECTED.</strong></p>

    <h2>11. Limitation of Liability</h2>
    <p><strong>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, BRIDGE LOGIC, ITS DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM: YOUR ACCESS TO, USE OF, OR INABILITY TO USE THE PLATFORM; ANY ERRORS, OMISSIONS, OR INACCURACIES IN THE CONTENT PROVIDED; ANY UNAUTHORISED ACCESS TO OR ALTERATION OF YOUR DATA OR TRANSMISSIONS; ANY THIRD-PARTY CONDUCT OR CONTENT ON THE PLATFORM; ANY AI-GENERATED ANALYSIS, SUMMARIES, OR INSIGHTS PROVIDED THROUGH THE PLATFORM; OR ANY OTHER MATTER RELATING TO THE PLATFORM OR SERVICES.</strong></p>
    <p><strong>IN NO EVENT SHALL BRIDGE LOGIC'S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE PLATFORM EXCEED THE AMOUNT PAID BY YOU, IF ANY, TO BRIDGE LOGIC FOR ACCESS TO THE PLATFORM DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</strong></p>

    <h2>12. Indemnification</h2>
    <p>You agree to indemnify, defend, and hold harmless Bridge Logic and its directors, officers, employees, agents, and affiliates from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees and costs) arising from or related to: your access to or use of the Platform; your violation of these Terms; your violation of any applicable law or regulation; your User Content; or your infringement of any rights of any third party.</p>

    <h2>13. Privacy</h2>
    <p>Your use of the Platform is also governed by our <Link to="/privacy">Privacy Policy</Link>. By using the Platform, you consent to the collection, use, and disclosure of your personal data as described in the Privacy Policy.</p>

    <h2>14. Service Availability and Modification</h2>
    <p>Bridge Logic reserves the right to modify, suspend, or discontinue the Platform or any part thereof, temporarily or permanently, at any time and without prior notice. Bridge Logic shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Platform.</p>

    <h2>15. Severability</h2>
    <p>If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision shall be enforced to the maximum extent permissible, and the remaining provisions of these Terms shall remain in full force and effect.</p>

    <h2>16. Entire Agreement</h2>
    <p>These Terms, together with the Privacy Policy and any other legal notices or agreements published by Bridge Logic on the Platform, constitute the entire agreement between you and Bridge Logic regarding your use of the Platform and supersede all prior or contemporaneous agreements, communications, and proposals, whether oral or written.</p>

    <h2>17. Waiver</h2>
    <p>The failure of Bridge Logic to exercise or enforce any right or provision of these Terms shall not constitute a waiver of such right or provision. Any waiver of any provision of these Terms will be effective only if in writing and signed by Bridge Logic.</p>

    <h2>18. Governing Law and Jurisdiction</h2>
    <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of Singapore, without regard to its conflict of law provisions. Any dispute arising out of or in connection with these Terms or the Platform shall be subject to the exclusive jurisdiction of the courts of Singapore.</p>

    <h2>19. Contact Information</h2>
    <p>If you have any questions or concerns about these Terms, please contact us at:</p>
    <p>Bridge Logic LP<br />Email: <a href="mailto:info@axle-finance.com">info@axle-finance.com</a><br />Website: axle-finance.com</p>

    <p className="legal-effective"><em>These Terms of Service are effective as of 16 March 2026.</em></p>
  </>
);

// ─── Disclaimer ──────────────────────────────────────────────────────────────────
const Disclaimer = () => (
  <>
    <h1>Disclaimer</h1>
    <p className="legal-meta">Last Updated: 16 March 2026</p>

    <h2>1. General Disclaimer</h2>
    <p>The information, materials, and services provided on the Axle platform at axle-finance.com (the "Platform") are provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. The Platform is owned and operated by Bridge Logic LP ("Bridge Logic"), a company registered in Singapore. Bridge Logic does not warrant that the Platform will be uninterrupted, error-free, secure, or free from viruses or other harmful components.</p>
    <p>The content on the Platform is intended solely for general information and operational purposes for authorised users. It does not constitute, and should not be construed as, a substitute for legal, commercial, financial, or other professional advice from an independent licensed or qualified professional.</p>

    <h2>2. No Financial or Investment Advice</h2>
    <p>Nothing contained on the Platform shall be construed as financial, investment, legal, tax, or other professional advice. The Platform provides tools for bond trading activity tracking, client relationship management, pipeline management, and analysis for informational purposes only.</p>
    <p>The Platform does not constitute:</p>
    <ul>
      <li>An offer, or a solicitation of an offer, to purchase or sell any investment product or financial instrument;</li>
      <li>An inducement or recommendation to purchase, sell, or hold any securities;</li>
      <li>A personalised financial, investment, or trading recommendation of any kind.</li>
    </ul>
    <p>Bridge Logic is not a licensed financial adviser, broker, dealer, or investment manager, and does not provide recommendations on the purchase, sale, or holding of any securities or financial instruments. Each user is solely responsible for its own independent decisions based on its own objectives, financial circumstances, and risk tolerance. Users should seek independent legal, tax, financial, and other professional advice before making any financial or investment decisions.</p>

    <h2>3. AI-Generated Content Disclaimer</h2>
    <p>The Platform utilises artificial intelligence ("AI") technologies, including third-party AI services, to analyse transcripts and generate insights, summaries, and recommendations. Users acknowledge and agree that:</p>
    <ul>
      <li>AI-generated content is provided for informational and reference purposes only;</li>
      <li>Bridge Logic does not guarantee the accuracy, completeness, reliability, or timeliness of any AI-generated output;</li>
      <li>AI-generated content may contain errors, omissions, or inaccuracies and should not be relied upon as the sole basis for any business, financial, or operational decision;</li>
      <li>Users are responsible for independently verifying all AI-generated content before relying on it; and</li>
      <li>AI-generated content does not constitute professional advice of any kind.</li>
    </ul>

    <h2>4. Limitation of Liability</h2>
    <p>To the fullest extent permitted by applicable law, Bridge Logic, its directors, officers, employees, agents, and affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, revenue, data, goodwill, or other intangible losses, resulting from:</p>
    <ul>
      <li>Your access to, use of, or inability to use the Platform;</li>
      <li>Any errors, omissions, or inaccuracies in the content provided on or through the Platform;</li>
      <li>Any unauthorised access to or alteration of your data or transmissions;</li>
      <li>Any third-party conduct or content on the Platform;</li>
      <li>Any AI-generated analysis, summaries, or insights provided through the Platform;</li>
      <li>Any interruption, suspension, or discontinuance of the Platform; or</li>
      <li>Any other matter relating to the Platform.</li>
    </ul>

    <h2>5. Intellectual Property</h2>
    <p>All content, trademarks, logos, trade names (including the "Axle" name and brand), software, and other intellectual property on the Platform are the property of Bridge Logic or its licensors and are protected under applicable intellectual property laws of Singapore and international treaties. Unauthorised reproduction, distribution, modification, display, or use of any materials on the Platform is strictly prohibited without the prior written consent of Bridge Logic.</p>

    <h2>6. Third-Party Links and Services</h2>
    <p>The Platform may contain links to third-party websites, services, or resources that are not owned, operated, or controlled by Bridge Logic. Bridge Logic does not endorse, control, or assume any responsibility for the content, privacy policies, practices, or availability of any third-party services. We do not have control over the content or actions of external websites we may link to. Your use of any third-party services is at your own risk and subject to the terms and conditions of those services.</p>

    <h2>7. Accuracy of Information</h2>
    <p>While Bridge Logic endeavours to ensure that the information provided on the Platform is accurate and up to date, we make no representations or warranties, express or implied, as to the accuracy, completeness, reliability, or currency of any information, data, or materials on the Platform. Market data, analytics, and other information displayed on the Platform may be subject to delays, errors, or omissions and should not be relied upon for time-sensitive decisions.</p>

    <h2>8. Service Availability</h2>
    <p>Bridge Logic makes reasonable efforts to maintain the availability and proper functioning of the Platform. However, the Platform may be subject to temporary interruptions due to maintenance, updates, technical issues, or circumstances beyond our control. Bridge Logic does not guarantee continuous, uninterrupted, or secure access to the Platform and shall not be liable for any loss or inconvenience caused by any interruption or unavailability.</p>

    <h2>9. Indemnification</h2>
    <p>You agree to indemnify, defend, and hold harmless Bridge Logic and its directors, officers, employees, agents, and affiliates from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising from or related to your use of the Platform, violation of this Disclaimer, or infringement of any rights of a third party.</p>

    <h2>10. Governing Law and Jurisdiction</h2>
    <p>This Disclaimer shall be governed by and construed in accordance with the laws of the Republic of Singapore. Any disputes arising out of or in connection with this Disclaimer shall be subject to the exclusive jurisdiction of the courts of Singapore.</p>

    <h2>11. Amendments</h2>
    <p>Bridge Logic reserves the right to modify, update, or revise this Disclaimer at any time without prior notice. Continued use of the Platform following any changes constitutes acceptance of the revised terms. Users are encouraged to review this Disclaimer periodically.</p>

    <h2>12. Contact Information</h2>
    <p>For any questions regarding this Disclaimer, please contact:</p>
    <p>Bridge Logic LP<br />Email: <a href="mailto:info@axle-finance.com">info@axle-finance.com</a><br />Website: axle-finance.com</p>

    <p className="legal-effective"><em>This Disclaimer is effective as of 16 March 2026.</em></p>
  </>
);

// ─── Page map ────────────────────────────────────────────────────────────────────
const PAGES = {
  privacy: { component: PrivacyPolicy, title: 'Privacy Policy' },
  terms: { component: TermsOfService, title: 'Terms of Service' },
  disclaimer: { component: Disclaimer, title: 'Disclaimer' },
};

// ─── Styles ──────────────────────────────────────────────────────────────────────
const LEGAL_STYLES = `
  .legal-page {
    font-family: 'Manrope', -apple-system, sans-serif;
    background: #0F2137;
    color: #F0EDE8;
    min-height: 100vh;
  }
  .legal-container {
    max-width: 780px;
    margin: 0 auto;
    padding: 60px 40px 80px;
  }
  .legal-nav {
    display: flex;
    gap: 24px;
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(200,162,88,0.15);
  }
  .legal-nav a {
    font-family: 'Manrope', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.4);
    text-decoration: none;
    transition: color 0.2s;
    letter-spacing: 0.02em;
  }
  .legal-nav a:hover { color: rgba(255,255,255,0.7); }
  .legal-nav a.active { color: #C8A258; }

  .legal-container h1 {
    font-size: 32px;
    font-weight: 700;
    color: #F0EDE8;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }
  .legal-meta {
    font-size: 14px;
    color: rgba(255,255,255,0.35);
    margin: 0 0 40px;
  }
  .legal-container h2 {
    font-size: 20px;
    font-weight: 600;
    color: #C8A258;
    margin: 40px 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(200,162,88,0.12);
  }
  .legal-container h3 {
    font-size: 16px;
    font-weight: 600;
    color: rgba(240,237,232,0.85);
    margin: 24px 0 12px;
  }
  .legal-container p {
    font-size: 15px;
    line-height: 1.75;
    color: rgba(240,237,232,0.7);
    margin: 0 0 16px;
  }
  .legal-container ul, .legal-container ol {
    padding-left: 24px;
    margin: 0 0 16px;
  }
  .legal-container li {
    font-size: 15px;
    line-height: 1.75;
    color: rgba(240,237,232,0.65);
    margin-bottom: 6px;
  }
  .legal-container strong {
    color: rgba(240,237,232,0.85);
  }
  .legal-container a {
    color: #C8A258;
    text-decoration: none;
    transition: color 0.2s;
  }
  .legal-container a:hover { color: #D4B06A; }
  .legal-container table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    font-size: 14px;
  }
  .legal-container th {
    text-align: left;
    padding: 10px 14px;
    background: rgba(200,162,88,0.08);
    color: rgba(240,237,232,0.7);
    font-weight: 600;
    border-bottom: 1px solid rgba(200,162,88,0.15);
  }
  .legal-container td {
    padding: 10px 14px;
    color: rgba(240,237,232,0.6);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .legal-effective {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.3) !important;
    font-size: 13px !important;
  }

  @media (max-width: 600px) {
    .legal-container { padding: 40px 20px 60px; }
    .legal-container h1 { font-size: 26px; }
    .legal-nav { gap: 16px; flex-wrap: wrap; }
  }
`;

// ─── Main component ──────────────────────────────────────────────────────────────
export default function LegalPage() {
  const { page } = useParams();
  const current = PAGES[page] || PAGES.privacy;
  const PageComponent = current.component;

  React.useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${current.title} | Axle`;
  }, [page, current.title]);

  return (
    <div className="legal-page">
      <style>{LEGAL_STYLES}</style>
      <MarketingNav />
      <div className="legal-container">
        <nav className="legal-nav">
          <Link to="/legal/privacy" className={page === 'privacy' ? 'active' : ''}>Privacy Policy</Link>
          <Link to="/legal/terms" className={page === 'terms' ? 'active' : ''}>Terms of Service</Link>
          <Link to="/legal/disclaimer" className={page === 'disclaimer' ? 'active' : ''}>Disclaimer</Link>
        </nav>
        <PageComponent />
      </div>
      <MarketingFooter />
    </div>
  );
}
