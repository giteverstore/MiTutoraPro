import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ADMIN_ROLES } from '../../../../shared/admin/adminAuthorization.js';
import { AdminApplication } from '../../src/AdminApp.jsx';
import { createBlock } from '../../src/content-studio/blocks/blockDefinitions.js';
import { createEmptyEditorDocument } from '../../src/content-studio/serialization/editorSerialization.js';
import '../../../../src/design-system/tokens.css';
import '../../src/styles.css';

const parameters = new URLSearchParams(window.location.search);
const role = parameters.get('role') === 'reviewer' ? ADMIN_ROLES.CONTENT_REVIEWER : ADMIN_ROLES.CONTENT_EDITOR;
const large = parameters.get('fixture') === 'large';
const initialPath = ({ dashboard: '/', projects: '/content/projects/new', courses: '/content/courses/new', practice: '/content/practice/new', challenges: '/content/challenges/new' })[parameters.get('mode')] ?? '/content/editor';

if (large) {
  const document = createEmptyEditorDocument();
  document.title = 'Synthetic 200 block performance fixture';
  document.blocks = Array.from({ length: 200 }, (_, index) => {
    const type = index % 5 === 0 ? 'code' : index % 5 === 1 ? 'callout' : 'paragraph';
    const block = createBlock(type);
    if (type === 'paragraph') return { ...block, text: `Synthetic paragraph ${index}: browser performance content.` };
    if (type === 'code') return { ...block, code: `print("Synthetic block ${index}")` };
    return { ...block, text: `Synthetic callout ${index}` };
  });
  localStorage.setItem(`ycoders.admin.content-draft.v1:${document.documentId}`, JSON.stringify(document));
  localStorage.setItem('ycoders.admin.content-draft.v1:active-document', document.documentId);
}

const session = { uid: 'browser-smoke-admin', email: 'browser-smoke@example.test', displayName: 'Browser Smoke', role };
const authClient = {
  subscribe(next) { queueMicrotask(() => next(session)); return () => {}; },
  signOut() {},
  refreshClaims: async () => session,
};

createRoot(document.getElementById('root')).render(<StrictMode><AdminApplication authClient={authClient} initialPath={initialPath} /></StrictMode>);
