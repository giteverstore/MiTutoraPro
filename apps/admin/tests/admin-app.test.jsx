import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ROLES } from '../../../shared/admin/adminAuthorization.js';
import { AdminApplication } from '../src/AdminApp.jsx';
import { AdminContentRequestError, isPreviewContentDisabled } from '../src/publishing/adminContentError.js';

afterEach(cleanup);

function authClientFor(session, { deferred = false } = {}) {
  let observer;
  return {
    subscribe: vi.fn((next) => { observer = next; if (!deferred) queueMicrotask(() => next(session)); return vi.fn(); }),
    signInWithEmail: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(),
    refreshClaims: vi.fn().mockResolvedValue(session),
    emit(value) { observer?.(value); },
  };
}

const session = (role) => ({ uid: `uid-${role ?? 'none'}`, email: 'admin@example.test', displayName: 'Admin User', role });

describe('Admin authentication and route guard', () => {
  it('shows login when unauthenticated', async () => {
    render(<AdminApplication authClient={authClientFor(null)} initialPath="/" />);
    expect(await screen.findByRole('heading', { name: 'Sign in to Y Coders Admin' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Content Studio' })).not.toBeInTheDocument();
  });

  it('does not flash protected content while claims load', async () => {
    const client = authClientFor(session(ADMIN_ROLES.SUPER_ADMIN), { deferred: true });
    render(<AdminApplication authClient={client} initialPath="/" />);
    expect(screen.getByRole('heading', { name: 'Checking Admin access' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Content Studio' })).not.toBeInTheDocument();
    client.emit(session(ADMIN_ROLES.SUPER_ADMIN));
    expect(await screen.findByRole('heading', { name: 'Content Studio' })).toBeInTheDocument();
  });

  it('keeps content status but removes duplicate dashboard module cards', async () => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath="/" />);
    expect(await screen.findByRole('heading', { name: 'Content status' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Content modules' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View status' })).not.toBeInTheDocument();
  });

  it.each(Object.values(ADMIN_ROLES))('renders the shell for %s', async (role) => {
    render(<AdminApplication authClient={authClientFor(session(role))} initialPath="/" />);
    expect(await screen.findByRole('complementary', { name: 'Admin navigation' })).toBeInTheDocument();
    expect(screen.getByText(role === ADMIN_ROLES.SUPER_ADMIN ? 'Super Admin' : role === ADMIN_ROLES.CONTENT_ADMIN ? 'Content Admin' : role === ADMIN_ROLES.CONTENT_EDITOR ? 'Content Editor' : 'Content Reviewer')).toBeInTheDocument();
  });

  it.each([null, 'UNKNOWN'])('shows access denied for role %s', async (role) => {
    render(<AdminApplication authClient={authClientFor(session(role))} initialPath="/" />);
    expect(await screen.findByRole('heading', { name: 'This account does not have access to Y Coders Admin.' })).toBeInTheDocument();
    expect(screen.getByText('admin@example.test')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Admin navigation' })).not.toBeInTheDocument();
  });
});

describe('Admin routing foundation', () => {
  it('keeps the Document Editor out of normal Content navigation', async () => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath="/" />);
    const navigation = await screen.findByRole('complementary', { name: 'Admin navigation' });
    const content = within(navigation).getByRole('region', { name: 'Content' });
    expect(within(content).getAllByRole('link').map((link) => link.textContent)).toEqual(['Projects', 'Courses', 'Practice', 'Challenges']);
    expect(within(navigation).queryByRole('region', { name: 'Internal' })).not.toBeInTheDocument();
    expect(within(navigation).queryByText('Document Editor')).not.toBeInTheDocument();
  });
  it.each([
    ['/admin/users', 'Users / Roles'], ['/admin/settings', 'Settings'], ['/admin/audit', 'Audit Log'],
  ])('renders the honest placeholder for %s', async (path, title) => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath={path} />);
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not implemented yet' })).toBeInTheDocument();
  });

  it.each([['/media/assets', 'Assets'], ['/publishing/drafts', 'Drafts'], ['/publishing/published', 'Published'], ['/publishing/versions', 'Version History']])('renders the real %s page', async (path, title) => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath={path} />);
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Not implemented yet' })).not.toBeInTheDocument();
  });

  it('keeps asset upload unavailable to reviewers', async () => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_REVIEWER))} initialPath="/media/assets" />);
    expect(await screen.findByRole('heading', { name: 'Assets', level: 1 })).toBeInTheDocument();
    expect(screen.queryByLabelText('Upload image')).not.toBeInTheDocument();
  });

  it('renders the Projects authoring landing page', async () => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath="/content/projects" />);
    expect(await screen.findByRole('heading', { name: 'Projects', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();
    expect(screen.queryByText('Not implemented yet')).not.toBeInTheDocument();
  });

  it.each([['/content/courses', 'Courses', 'New Course'], ['/content/practice', 'Practice', 'New Practice Question'], ['/content/challenges', 'Challenges', 'New Challenge']])('renders the authoring landing page for %s', async (path, title, action) => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath={path} />);
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
    expect(screen.queryByText('Not implemented yet')).not.toBeInTheDocument();
  });

  it('keeps Project authoring read-only for reviewers', async () => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_REVIEWER))} initialPath="/content/projects/reviewer-fixture/edit" />);
    expect(await screen.findByRole('heading', { name: 'Untitled Project' })).toBeInTheDocument();
    expect(screen.getByText(/Read only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add checkpoint' })).not.toBeInTheDocument();
  });

  it('handles unknown routes inside the authorized shell', async () => {
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath="/unknown" />);
    expect(await screen.findByRole('heading', { name: 'Admin page not found' })).toBeInTheDocument();
  });

  it.each([
    [ADMIN_ROLES.CONTENT_ADMIN, false],
    [ADMIN_ROLES.CONTENT_EDITOR, false],
    [ADMIN_ROLES.CONTENT_REVIEWER, true],
  ])('applies content edit permission for %s', async (role, readOnly) => {
    render(<AdminApplication authClient={authClientFor(session(role))} initialPath="/content/editor" />);
    expect(await screen.findByRole('heading', { name: 'Document Editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Heading block' })).toHaveProperty('disabled', readOnly);
    expect(Boolean(screen.queryByText('Read only'))).toBe(readOnly);
  });
});

describe('Preview content access', () => {
  const disabled = () => new AdminContentRequestError({ status: 503 }, { error: { code: 'admin/preview-backend-disabled', message: 'Preview content is not configured.' } }, 'Request failed.');

  it.each(['/publishing/drafts', '/publishing/versions', '/content/courses/course-1/edit'])('shows a safe state without loading dependent content at %s', async (path) => {
    const checkContentAccess = vi.fn().mockRejectedValue(disabled());
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath={path} enableContentGate checkContentAccess={checkContentAccess} />);
    expect(await screen.findByRole('heading', { name: 'Preview backend content is disabled.' })).toBeInTheDocument();
    expect(screen.getByText('This Preview deployment cannot read or modify production Admin content.')).toBeInTheDocument();
    expect(checkContentAccess).toHaveBeenCalledExactlyOnceWith('draft-summaries?limit=1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([404, 500])('does not classify a normal %s as Preview-disabled', async (status) => {
    const error = new AdminContentRequestError({ status }, { error: { code: 'content/test', message: 'Normal error' } }, 'Request failed.');
    expect(isPreviewContentDisabled(error)).toBe(false);
    const checkContentAccess = vi.fn().mockRejectedValue(error);
    render(<AdminApplication authClient={authClientFor(session(ADMIN_ROLES.CONTENT_ADMIN))} initialPath="/content/courses" enableContentGate checkContentAccess={checkContentAccess} />);
    expect(await screen.findByRole('heading', { name: 'Courses', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Preview backend content is disabled.')).not.toBeInTheDocument();
  });

  it('requires both the explicit code and 503 status', () => {
    expect(isPreviewContentDisabled(disabled())).toBe(true);
    expect(isPreviewContentDisabled(new AdminContentRequestError({ status: 503 }, { error: { code: 'content/server-error' } }, 'Request failed.'))).toBe(false);
    expect(isPreviewContentDisabled(new AdminContentRequestError({ status: 404 }, { error: { code: 'admin/preview-backend-disabled' } }, 'Request failed.'))).toBe(false);
  });
});
