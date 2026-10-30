import { describe, expect, it, vi } from 'vitest';
import { writeJsonResponse } from '../../server/http/writeJsonResponse.js';

describe('writeJsonResponse', () => {
  it('writes JSON with the requested status and additional headers', () => {
    const response = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };

    writeJsonResponse(response, 405, { error: { code: 'method-not-allowed' } }, { Allow: 'POST' });

    expect(response.statusCode).toBe(405);
    expect(response.setHeader).toHaveBeenNthCalledWith(1, 'Allow', 'POST');
    expect(response.setHeader).toHaveBeenNthCalledWith(2, 'Content-Type', 'application/json; charset=utf-8');
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: { code: 'method-not-allowed' } }));
  });
});
