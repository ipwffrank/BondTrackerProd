// Module access configuration per subscription tier
// Routes not listed here are accessible to all tiers

const MODULE_ACCESS = {
  '/pipeline':     { minTier: 'growth', label: 'Pipeline', tier: 'Growth' },
  '/analytics':    { minTier: 'growth', label: 'Analytics', tier: 'Growth' },
  '/ai-assistant': { minTier: 'growth', label: 'AI Assistant', tier: 'Growth' },
};

const TIER_RANK = { essential: 1, growth: 2, professional: 3 };

export function canAccessModule(route, orgPlan) {
  const rule = MODULE_ACCESS[route];
  if (!rule) return true; // no restriction
  const planRank = TIER_RANK[orgPlan] || 0;
  const requiredRank = TIER_RANK[rule.minTier] || 0;
  return planRank >= requiredRank;
}

export function getModuleGate(route) {
  return MODULE_ACCESS[route] || null;
}

export function getTierLabel(plan) {
  return { essential: 'Essential', growth: 'Growth', professional: 'Professional' }[plan] || 'Essential';
}

// Export format access per tier
// Essential: CSV only | Growth: CSV, Excel, PDF | Professional: all + API
export function canExport(format, orgPlan) {
  const rank = TIER_RANK[orgPlan] || 0;
  if (format === 'csv') return true; // all tiers
  if (format === 'excel' || format === 'pdf') return rank >= 2; // growth+
  if (format === 'api') return rank >= 3; // professional only
  return false;
}

// SSO/SAML access — Growth tier and above. Banks and securities houses
// require SSO, so it can't be Pro-gated without forcing every ICP
// customer to the top tier.
export function canUseSso(orgPlan) {
  return (TIER_RANK[orgPlan] || 0) >= 2;
}

export const TIER_OPTIONS = ['essential', 'growth', 'professional'];
