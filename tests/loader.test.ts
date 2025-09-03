import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentLoader } from '../src/content/loader';

describe('ContentLoader', () => {
  let loader: ContentLoader;
  let mockFetch: any;

  beforeEach(() => {
    // Clear any existing instances
    (ContentLoader as any).instance = undefined;
    loader = ContentLoader.getInstance();
    
    // Mock fetch globally
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    
    vi.clearAllMocks();
  });

  it('should load catalog successfully', async () => {
    const mockCatalog = {
      schema: 'debutlab.catalog.v1',
      updatedAt: '2025-01-02T00:00:00Z',
      debuts: []
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCatalog
    });

    const result = await loader.loadCatalog();
    expect(result).toEqual(mockCatalog);
    expect(mockFetch).toHaveBeenCalledWith('/content/catalog.json');
  });

  it('should throw error for invalid catalog schema', async () => {
    const mockCatalog = {
      schema: 'invalid.schema',
      updatedAt: '2025-01-02T00:00:00Z',
      debuts: []
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCatalog
    });

    await expect(loader.loadCatalog()).rejects.toThrow('Invalid catalog schema');
  });

  it('should throw error for failed fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    await expect(loader.loadCatalog()).rejects.toThrow('Failed to load catalog: 404');
  });

  it('should load debut successfully', async () => {
    const mockCatalog = {
      schema: 'debutlab.catalog.v1',
      updatedAt: '2025-01-02T00:00:00Z',
      debuts: [{
        id: 'test-debut',
        name: 'Test Debut',
        side: 'white',
        tags: [],
        file: 'demo/test.v1.json',
        hash: 'test',
        branches: 1,
        approxSizeKB: 1
      }]
    };

    const mockDebut = {
      schema: 'debutlab.debut.v1',
      id: 'test-debut',
      name: 'Test Debut',
      side: 'white',
      tags: [],
      branches: []
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCatalog
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDebut
      });

    const result = await loader.loadDebut('test-debut');
    expect(result).toEqual(mockDebut);
  });

  it('should throw error for debut not found', async () => {
    const mockCatalog = {
      schema: 'debutlab.catalog.v1',
      updatedAt: '2025-01-02T00:00:00Z',
      debuts: []
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCatalog
    });

    await expect(loader.loadDebut('non-existent')).rejects.toThrow('Debut not found');
  });
});
