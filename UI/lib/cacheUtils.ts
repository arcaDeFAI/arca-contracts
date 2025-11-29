/**
 * Utility functions for managing localStorage cache
 */

/**
 * Clear all Shadow APY related caches
 * Useful when migrating from old to new APY calculation
 */
export function clearAllShadowCaches() {
  try {
    const keysToRemove: string[] = [];
    
    // Find all Shadow-related cache keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('shadow_claims_') || 
        key.startsWith('defi_llama_apy_cache')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    return keysToRemove.length;
  } catch (error) {
    return 0;
  }
}

/**
 * Clear all Metro APY related caches
 */
export function clearAllMetroCaches() {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('metro_transfers_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    return keysToRemove.length;
  } catch (error) {
    return 0;
  }
}

/**
 * Clear all APY caches (both Shadow and Metro)
 */
export function clearAllAPYCaches() {
  const shadowCount = clearAllShadowCaches();
  const metroCount = clearAllMetroCaches();
  
  return shadowCount + metroCount;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  try {
    const stats = {
      shadowClaims: 0,
      metroTransfers: 0,
      defiLlama: 0,
      other: 0,
      total: localStorage.length,
    };
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.startsWith('shadow_claims_')) {
        stats.shadowClaims++;
      } else if (key.startsWith('metro_transfers_')) {
        stats.metroTransfers++;
      } else if (key.startsWith('defi_llama_apy_cache')) {
        stats.defiLlama++;
      } else {
        stats.other++;
      }
    }
    
    return stats;
  } catch (error) {
    return null;
  }
}

/**
 * Display cache statistics in console
 */
export function logCacheStats() {
  const stats = getCacheStats();
  
  if (!stats) return;
  
  // Cache stats available for debugging if needed
  return stats;
}

// Make functions available in browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).clearAllShadowCaches = clearAllShadowCaches;
  (window as any).clearAllMetroCaches = clearAllMetroCaches;
  (window as any).clearAllAPYCaches = clearAllAPYCaches;
  (window as any).getCacheStats = getCacheStats;
  (window as any).logCacheStats = logCacheStats;
}
