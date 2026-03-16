// Module access configuration per subscription tier
// Routes not listed here are accessible to all tiers

const MODULE_ACCESS = {
  '/pipeline':     { minTier: 'professional', label: 'Pipeline', tier: 'Professional' },
  '/analytics':    { minTier: 'professional', label: 'Analytics', tier: 'Professional' },
  '/ai-assistant': { minTier: 'professional', label: 'AI Assistant', tier: 'Professional' },
};

const TIER_RANK = { essentials: 1, professional: 2, institutional: 3 };

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
  return { essentials: 'Essentials', professional: 'Professional', institutional: 'Institutional' }[plan] || 'Essentials';
}

export const TIER_OPTIONS = ['essentials', 'professional', 'institutional'];
