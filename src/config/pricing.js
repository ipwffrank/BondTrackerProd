// Single source of truth for tier pricing, seat caps, and feature lists.
// Both LandingPage and admin Organizations dropdown read from here so the
// numbers can never drift between marketing and billing surfaces.

export const ANNUAL_DISCOUNT = 0.17;

export const TIERS = {
  essential: {
    id: 'essential',
    label: 'Essential',
    monthly: 799,
    seatCap: 5,
    description: 'For solo PMs and small desks evaluating Axle. No AI, no Pipeline, no SSO.',
    features: [
      'Activity logging',
      'Client & contact CRM',
      'Team management',
      'CSV export',
      '12-month data retention',
    ],
    excludedFeatures: ['No AI Assistant', 'No Pipeline', 'No Analytics', 'No SSO'],
    cta: 'Request a Pilot',
    role: 'starter',
  },
  growth: {
    id: 'growth',
    label: 'Growth',
    monthly: 2800,
    seatCap: 20,
    description: 'Full platform for bank and securities-house desks. AI, Pipeline, Analytics, SSO included.',
    features: [
      'Everything in Essential',
      'Pipeline & DCM deal tracking',
      'Analytics dashboard',
      'AI transcript analysis (Bloomberg, Symphony, Email)',
      'SSO / SAML',
      'Excel & PDF export',
      '36-month data retention',
    ],
    cta: 'Request a Pilot',
    role: 'target',
    featured: true,
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    monthly: 5500,
    seatCap: null, // unlimited
    description: 'For larger institutions with API integration, dedicated support, or extended retention requirements.',
    features: [
      'Everything in Growth',
      'API access',
      'Dedicated CSM (4hr SLA)',
      'Custom branding',
      'Unlimited data retention',
      'White-glove onboarding',
    ],
    cta: 'Talk to Sales',
    role: 'upmarket',
  },
};

export const TIER_ORDER = ['essential', 'growth', 'professional'];

export function annualPrice(monthly) {
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
}

export function annualMonthlyEquivalent(monthly) {
  return Math.round(monthly * (1 - ANNUAL_DISCOUNT));
}

export function formatSeatCap(cap) {
  return cap === null ? 'Unlimited seats' : `Up to ${cap} seats`;
}

export function formatPriceUSD(amount) {
  return `$${amount.toLocaleString('en-US')}`;
}
