import { describe, expect, it, vi } from 'vitest';
import { cleanupPdfResources } from './resourceCleanup';

describe('cleanupPdfResources', () => {
  it('uses PDFDocumentProxy.cleanup and PDFDocumentLoadingTask.destroy', async () => {
    const terminate = vi.fn();
    const cleanup = vi.fn();
    const destroy = vi.fn();

    await expect(cleanupPdfResources({
      ocrWorker: { terminate },
      pdf: { cleanup },
      loadingTask: { destroy },
    })).resolves.toBeUndefined();

    expect(terminate).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('does not throw when a method is missing or cleanup rejects', async () => {
    await expect(cleanupPdfResources({
      ocrWorker: null,
      pdf: { cleanup: () => Promise.reject(new Error('cleanup failed')) },
      loadingTask: {},
    })).resolves.toBeUndefined();
  });
});

