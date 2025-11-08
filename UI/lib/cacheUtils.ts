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
    
    console.log(`✅ Cleared ${keysToRemove.length} Shadow APY cache entries`);
    return keysToRemove.length;
  } catch (error) {
    console.error('❌ Failed to clear Shadow APY caches:', error);
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
    
    console.log(`✅ Cleared ${keysToRemove.length} Metro APY cache entries`);
    return keysToRemove.length;
  } catch (error) {
    console.error('❌ Failed to clear Metro APY caches:', error);
    return 0;
  }
}

/**
 * Clear all APY caches (both Shadow and Metro)
 */
export function clearAllAPYCaches() {
  const shadowCount = clearAllShadowCaches();
  const metroCount = clearAllMetroCaches();
  
  console.log(`✅ Total cleared: ${shadowCount + metroCount} cache entries`);
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
    console.error('❌ Failed to get cache stats:', error);
    return null;
  }
}

/**
 * Display cache statistics in console
 */
export function displayCacheStats() {
  const stats = getCacheStats();
  
  if (!stats) {
    console.error('❌ Could not retrieve cache statistics');
    return;
  }
  
  console.log('📊 Cache Statistics:');
  console.log(`   Shadow Claims: ${stats.shadowClaims}`);
  console.log(`   Metro Transfers: ${stats.metroTransfers}`);
  console.log(`   DeFi Llama: ${stats.defiLlama}`);
  console.log(`   Other: ${stats.other}`);
  console.log(`   Total: ${stats.total}`);
}

// Make functions available in browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).clearAllShadowCaches = clearAllShadowCaches;
  (window as any).clearAllMetroCaches = clearAllMetroCaches;
  (window as any).clearAllAPYCaches = clearAllAPYCaches;
  (window as any).displayCacheStats = displayCacheStats;
}
