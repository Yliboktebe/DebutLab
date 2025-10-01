/**
 * COMPATIBILITY SHIM - WILL BE REMOVED IN v0.3.0
 * 
 * This file has been moved to: src/data/content/loader.ts
 * 
 * Migration:
 *   Old: import { ... } from '@/content/loader'
 *   New: import { ... } from '@/data/content/loader'
 * 
 * TTL: 2 releases (~2-3 months)
 */

if (import.meta.env.DEV) {
  const warned = '__compat_content_loader_warned';
  if (!(window as any)[warned]) {
    console.warn(
      `[DEPRECATED] Importing from @/content/loader is deprecated.\n` +
      `Use @/data/content/loader instead.\n` +
      `This shim will be removed in v0.3.0\n` +
      `See COMPAT_POLICY.md for details.`
    );
    (window as any)[warned] = true;
  }
}

export * from '@/data/content/loader';

