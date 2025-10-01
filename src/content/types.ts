/**
 * COMPATIBILITY SHIM - WILL BE REMOVED IN v0.3.0
 * 
 * This file has been moved to: src/data/content/types.ts
 * 
 * Migration:
 *   Old: import { ... } from '@/content/types'
 *   New: import { ... } from '@/data/content/types'
 * 
 * TTL: 2 releases (~2-3 months)
 */

if (import.meta.env.DEV) {
  const warned = '__compat_content_types_warned';
  if (!(window as any)[warned]) {
    console.warn(
      `[DEPRECATED] Importing from @/content/types is deprecated.\n` +
      `Use @/data/content/types instead.\n` +
      `This shim will be removed in v0.3.0\n` +
      `See COMPAT_POLICY.md for details.`
    );
    (window as any)[warned] = true;
  }
}

export * from '@/data/content/types';

