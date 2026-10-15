import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetPreview } from '../src/publishing/AssetsPage.jsx';
import { adminContentRequest } from '../src/publishing/publishingApi.js';

vi.mock('../src/publishing/publishingApi.js', () => ({ adminContentRequest: vi.fn() }));

const assetId = 'asset-11111111-1111-4111-8111-111111111111';
afterEach(() => vi.restoreAllMocks());

describe('Admin Course asset preview resolution', () => {
  it('loads registered metadata and private bytes without embedding a signed URL in the draft', async () => {
    adminContentRequest.mockImplementation(async (path) => path.endsWith('/file') ? new Blob(['image'], { type: 'image/png' })
      : { asset: { assetId, path: `admin-content-assets/${assetId}.png`, mediaType: 'image/png' } });
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:admin-preview', revokeObjectURL: vi.fn() });
    render(<AssetPreview asset={{ assetId }} alt="Git branch diagram" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Git branch diagram' })).toHaveAttribute('src', 'blob:admin-preview'));
    expect(adminContentRequest).toHaveBeenCalledWith(`assets/${assetId}`);
    expect(adminContentRequest).toHaveBeenCalledWith(`assets/${assetId}/file`, { binary: true });
    vi.unstubAllGlobals();
  });

  it('fails closed when the registry cannot resolve the asset', async () => {
    adminContentRequest.mockRejectedValue(new Error('not found'));
    render(<AssetPreview asset={{ assetId }} alt="Missing image" />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Preview unavailable'));
    expect(screen.queryByRole('img', { name: 'Missing image' })).not.toBeInTheDocument();
  });
});
