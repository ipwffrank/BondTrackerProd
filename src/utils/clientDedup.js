// Common financial industry suffixes to strip when comparing client names
const SUFFIXES = [
  'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation',
  'am', 'asset management', 'fund management', 'investment management',
  'im', 'holdings', 'capital', 'partners', 'group', 'pte', 'co',
  'llc', 'lp', 'plc', 'sa', 'ag', 'gmbh', 'bv', 'nv',
];

// Normalize a client name: lowercase, trim, strip suffixes
function normalize(name) {
  let n = name.toLowerCase().trim();
  // Remove punctuation
  n = n.replace(/[.,()]/g, ' ').replace(/\s+/g, ' ').trim();
  // Strip known suffixes (greedily, longest first)
  const sorted = [...SUFFIXES].sort((a, b) => b.length - a.length);
  for (const suffix of sorted) {
    const re = new RegExp(`\\s+${suffix.replace(/\s+/g, '\\s+')}\\s*$`, 'i');
    n = n.replace(re, '').trim();
  }
  return n;
}

// Tokenize into word set
function tokenize(name) {
  return new Set(normalize(name).split(/\s+/).filter(Boolean));
}

// Jaccard similarity between two sets
function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find existing clients that are similar to a new client name.
 * @param {string} newName - The name to check
 * @param {Array<{id: string, name: string}>} existingClients - List of existing clients
 * @returns {Array<{client: object, matchType: string, score: number}>} Matches sorted by score desc
 */
export function findSimilarClients(newName, existingClients) {
  if (!newName || !existingClients?.length) return [];

  const normNew = normalize(newName);
  const tokensNew = tokenize(newName);
  const matches = [];

  for (const client of existingClients) {
    const normExisting = normalize(client.name);

    // Exact normalized match
    if (normNew === normExisting) {
      matches.push({ client, matchType: 'exact', score: 1.0 });
      continue;
    }

    // Containment check: shorter name is contained in longer name
    const shorter = normNew.length <= normExisting.length ? normNew : normExisting;
    const longer = normNew.length <= normExisting.length ? normExisting : normNew;
    if (shorter.length >= 2 && longer.includes(shorter)) {
      const score = shorter.length / longer.length;
      if (score >= 0.3) {
        matches.push({ client, matchType: 'contains', score: Math.min(0.95, 0.5 + score * 0.4) });
        continue;
      }
    }

    // Token overlap (Jaccard)
    const tokensExisting = tokenize(client.name);
    const jScore = jaccard(tokensNew, tokensExisting);
    if (jScore >= 0.5) {
      matches.push({ client, matchType: 'similar', score: jScore * 0.9 });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
