import { Catalog, Debut } from '@/content/types';

const CONTENT_BASE = '/content';

export class ContentLoader {
  private static instance: ContentLoader;
  private cache = new Map<string, any>();

  static getInstance(): ContentLoader {
    if (!ContentLoader.instance) {
      ContentLoader.instance = new ContentLoader();
    }
    return ContentLoader.instance;
  }

  async loadCatalog(): Promise<Catalog> {
    const cacheKey = 'catalog';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${CONTENT_BASE}/catalog.json`);
      if (!response.ok) {
        throw new Error(`Failed to load catalog: ${response.status}`);
      }

      const catalog: Catalog = await response.json();
      
      // Validate schema
      if (catalog.schema !== 'debutlab.catalog.v1') {
        throw new Error(`Invalid catalog schema: ${catalog.schema}`);
      }

      this.cache.set(cacheKey, catalog);
      return catalog;
    } catch (error) {
      console.error('Error loading catalog:', error);
      throw error;
    }
  }

  async loadDebut(debutId: string): Promise<Debut> {
    const cacheKey = `debut-${debutId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // First get catalog to find the file path
      const catalog = await this.loadCatalog();
      const debutItem = catalog.debuts.find(d => d.id === debutId);
      
      if (!debutItem) {
        throw new Error(`Debut not found: ${debutId}`);
      }

      const response = await fetch(`${CONTENT_BASE}/${debutItem.file}`);
      if (!response.ok) {
        throw new Error(`Failed to load debut ${debutId}: ${response.status}`);
      }

      const debut: Debut = await response.json();
      
      // Validate schema
      if (debut.schema !== 'debutlab.debut.v1') {
        throw new Error(`Invalid debut schema: ${debut.schema}`);
      }

      if (debut.id !== debutId) {
        throw new Error(`Debut ID mismatch: expected ${debutId}, got ${debut.id}`);
      }

      this.cache.set(cacheKey, debut);
      return debut;
    } catch (error) {
      console.error(`Error loading debut ${debutId}:`, error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearDebutCache(debutId: string): void {
    this.cache.delete(`debut-${debutId}`);
  }
}

export const contentLoader = ContentLoader.getInstance();
