import { 
  IMAGE_AUDIT_REASONS, 
  RecipeImageMetadata, 
  ImageAuditReason,
  ImageAuditStatus
} from './plannerTypes';

/**
 * RecipeImageAuditor
 * Centralized logic for Tier 1 (Recipe-Level) audits and fingerprinting.
 */

const KNOWN_PLACEHOLDERS = [
  'photo-1473093295043-cdd812d0e601', // Example generic pasta used frequently
  'photo-1543339308-43e59d6b73a6', // Example generic bowl
  // Add more as discovered
];

/**
 * Generates a normalized fingerprint for a URL to detect duplicates across providers.
 */
export function getImageFingerprint(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (typeof url !== 'string') return `local_asset:${url}`; // Handle require() numbers

  try {
    const parsed = new URL(url);
    
    // 1. Unsplash Special Handling
    if (parsed.hostname.includes('unsplash.com')) {
      const photoId = parsed.pathname.split('/').pop() || '';
      if (photoId.startsWith('photo-')) {
        return `unsplash:${photoId}`;
      }
    }

    // 2. Generic Normalization
    // Strip query params and hashes, lowercase
    const normalizedPath = parsed.origin + parsed.pathname.toLowerCase().replace(/\/$/, '');
    return `generic:${normalizedPath}`;
  } catch (e) {
    // If invalid URL, just return a sanitized version of the string
    return `raw:${url.split('?')[0].toLowerCase()}`;
  }
}

/**
 * Performs a Tier 1 (local) audit on a single recipe.
 * Does NOT include catalog-wide checks (duplicates).
 */
export function auditRecipeImage(
  title: string, 
  imageUrl: string | undefined
): RecipeImageMetadata {
  const reasons: ImageAuditReason[] = [];
  let status: ImageAuditStatus = 'correct';
  const fingerprint = getImageFingerprint(imageUrl);

  // 1. Missing Check
  if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim() === '')) {
    reasons.push(IMAGE_AUDIT_REASONS.MISSING_URL);
    return {
      sourceType: 'fallback',
      provider: 'unknown',
      status: 'missing',
      reasons,
      lastCheckedAt: new Date().toISOString()
    };
  }

  // 2. Placeholder Check
  if (fingerprint && fingerprint.startsWith('unsplash:')) {
    const id = fingerprint.split(':')[1];
    if (KNOWN_PLACEHOLDERS.includes(id)) {
      status = 'suspect';
      reasons.push(IMAGE_AUDIT_REASONS.PLACEHOLDER_IMAGE);
    }
  }

  // 3. Keyword Weak Mismatch Check (only for strings)
  if (typeof imageUrl === 'string') {
    const titleWords = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3);
    const urlLower = imageUrl.toLowerCase();
    
    const hasKeywordMatch = titleWords.some(word => urlLower.includes(word));
    if (titleWords.length > 0 && !hasKeywordMatch) {
      reasons.push(IMAGE_AUDIT_REASONS.KEYWORD_MISMATCH_WEAK);
      // We don't mark as suspect on weak keyword mismatch alone, 
      // but we record the reason for potential review.
    }
  }

  return {
    sourceType: typeof imageUrl === 'string' ? 'imported' : 'generated',
    provider: typeof imageUrl === 'string' && imageUrl.includes('unsplash') ? 'unsplash' : 'internal',
    status,
    reasons,
    fingerprint,
    lastCheckedAt: new Date().toISOString()
  };
}
