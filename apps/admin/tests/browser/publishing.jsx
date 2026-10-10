import React from 'react';
import { createRoot } from 'react-dom/client';
import { auth } from '../../../../src/firebase/auth.js';
import { ADMIN_ROLES } from '../../../../shared/admin/adminAuthorization.js';
import { AdminApplication } from '../../src/AdminApp.jsx';
import '../../src/styles.css';

// This page is served only by the browser-test Vite server. HTTP fixtures still
// exercise the Admin UI's bearer-token request path without real credentials.
auth.currentUser = { getIdToken: async () => 'browser-fixture-token' };
const role = new URLSearchParams(location.search).get('role') === 'reviewer' ? ADMIN_ROLES.CONTENT_REVIEWER : ADMIN_ROLES.CONTENT_ADMIN;
const session = { uid: 'browser-fixture', email: 'browser@example.test', role };
const client = { subscribe(next) { queueMicrotask(() => next(session)); return () => {}; }, signOut() {}, refreshClaims: async () => session };
createRoot(document.getElementById('root')).render(<AdminApplication authClient={client} initialPath={new URLSearchParams(location.search).get('initialPath') ?? '/publishing/drafts'} />);
