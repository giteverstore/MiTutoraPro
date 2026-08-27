import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeService } from '../../src/content/services/PracticeService';
import { createPracticeSourceAdapter } from '../../src/practice/practiceContentSourceCore';
import {
  annotatePracticeError,
  createPracticeDiagnostic,
  getPracticeDiagnostic,
  PRACTICE_DIAGNOSTIC_STAGES,
  reportPracticeDiagnostic,
} from '../../src/practice/practiceDiagnostics';

const { listPage } = vi.hoisted(() => ({ listPage: vi.fn() }));

vi.mock('../../src/practice/practiceContentSource', () => ({
  practiceContentSource: {
    listPage,
    loadQuestion: vi.fn(),
    loadQuestionById: vi.fn(),
  },
}));

import { PracticePage } from '../../src/practice/PracticePage';

const firebaseError = (code, extras = {}) => Object.assign(new Error('sensitive raw response'), {
  name: 'FirebaseError',
  code,
  uid: 'private-user',
  requestUrl: 'https://example.invalid/channel?SID=secret',
  token: 'secret-token',
  ...extras,
});

const createAdapter = (firebaseService, onDiagnostic = vi.fn()) => createPracticeSourceAdapter({
  source: 'firebase',
  firebaseService,
  localQuestions: [],
  onDiagnostic,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Practice diagnostics', () => {
  it.each([
    ['permission-denied', 'authorization', false],
    ['unavailable', 'availability', true],
  ])('classifies publication-read %s without replacing the exception', async (code, category, retryable) => {
    const error = firebaseError(code);
    const onDiagnostic = vi.fn();
    const adapter = createAdapter({
      getPublication: vi.fn().mockRejectedValue(error),
      listMetadataPage: vi.fn().mockRejectedValue(error),
    }, onDiagnostic);

    await expect(adapter.listPage({ filters: {} })).rejects.toBe(error);
    expect(onDiagnostic).toHaveBeenCalledWith(error, PRACTICE_DIAGNOSTIC_STAGES.publicationRead);
    expect(getPracticeDiagnostic(error, PRACTICE_DIAGNOSTIC_STAGES.publicationRead)).toEqual({
      stage: 'publication-read', code, name: 'FirebaseError', category, retryable,
    });
  });

  it.each([
    ['permission-denied', 'authorization', false],
    ['unavailable', 'availability', true],
  ])('classifies metadata-query %s and preserves retry classification', async (code, category, retryable) => {
    const first = firebaseError(code);
    const second = firebaseError(code);
    const onDiagnostic = vi.fn();
    const listMetadataPage = vi.fn().mockRejectedValueOnce(first).mockRejectedValueOnce(second);
    const adapter = createAdapter({ getPublication: vi.fn().mockResolvedValue(null), listMetadataPage }, onDiagnostic);

    await expect(adapter.listPage({ filters: {} })).rejects.toBe(first);
    await expect(adapter.listPage({ filters: {} })).rejects.toBe(second);
    for (const error of [first, second]) {
      expect(getPracticeDiagnostic(error, PRACTICE_DIAGNOSTIC_STAGES.metadataQuery)).toEqual({
        stage: 'metadata-query', code, name: 'FirebaseError', category, retryable,
      });
    }
  });

  it('identifies metadata normalization separately from the Firestore query', async () => {
    const repository = {
      listMetadataPage: vi.fn().mockResolvedValue({ items: [{ id: 'broken' }], cursor: null, hasMore: false }),
    };
    const service = new PracticeService(repository);

    await expect(service.listMetadataPage({ query: {} })).rejects.toSatisfy((error) => {
      expect(getPracticeDiagnostic(error)).toMatchObject({ stage: 'metadata-normalization', category: 'invalid-data' });
      return true;
    });
  });

  it('emits only whitelisted fields and excludes sensitive error properties', () => {
    const error = firebaseError('firestore/permission-denied');
    annotatePracticeError(error, PRACTICE_DIAGNOSTIC_STAGES.metadataQuery);
    const logger = vi.fn();
    const diagnostic = reportPracticeDiagnostic(error, PRACTICE_DIAGNOSTIC_STAGES.metadataQuery, logger);

    expect(Object.keys(diagnostic)).toEqual(['stage', 'code', 'name', 'category', 'retryable']);
    expect(JSON.stringify(diagnostic)).not.toMatch(/private-user|secret|SID|channel|response/i);
    expect(logger).toHaveBeenCalledWith('[Practice content]', diagnostic);
  });

  it('sanitizes arbitrary code and name values', () => {
    const diagnostic = createPracticeDiagnostic({ code: 'token=<secret>', name: 'Error\nprivate' }, 'metadata-query');
    expect(diagnostic).toMatchObject({ code: 'unknown', name: 'Error', category: 'unexpected' });
  });

  it('exposes a safe browser-readable stage and keeps Retry on the same path', async () => {
    listPage.mockReset();
    listPage
      .mockRejectedValueOnce(annotatePracticeError(firebaseError('unavailable'), 'metadata-query'))
      .mockRejectedValueOnce(annotatePracticeError(firebaseError('unavailable'), 'metadata-query'));

    render(<PracticePage />);
    const heading = await screen.findByText('Sharpen your coding skills.');
    const diagnosticBoundary = heading.closest('header');
    expect(diagnosticBoundary).toHaveAttribute('data-practice-error-stage', 'metadata-query');
    expect(diagnosticBoundary).toHaveAttribute('data-practice-error-code', 'unavailable');
    expect(diagnosticBoundary).toHaveAttribute('data-practice-error-category', 'availability');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));
    expect(diagnosticBoundary).not.toHaveAttribute('data-practice-error-uid');
    expect(document.body.innerHTML).not.toContain('secret-token');
  });
});
