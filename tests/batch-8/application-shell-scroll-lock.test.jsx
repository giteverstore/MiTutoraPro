import { render, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from '../../src/components/Dialog';
import {
  AUTHENTICATED_SHELL_BODY_CLASS,
  useAuthenticatedShellScrollLock,
} from '../../src/app-shell/useAuthenticatedShellScrollLock';

describe('authenticated application scroll ownership', () => {
  afterEach(() => {
    document.body.classList.remove(AUTHENTICATED_SHELL_BODY_CLASS);
  });

  it('locks the document for an authenticated shell and restores public document scrolling on cleanup', () => {
    const firstShell = renderHook(() => useAuthenticatedShellScrollLock());
    expect(document.body).toHaveClass(AUTHENTICATED_SHELL_BODY_CLASS);

    firstShell.unmount();
    expect(document.body).not.toHaveClass(AUTHENTICATED_SHELL_BODY_CLASS);

    const secondShell = renderHook(() => useAuthenticatedShellScrollLock());
    expect(document.body).toHaveClass(AUTHENTICATED_SHELL_BODY_CLASS);
    secondShell.unmount();
    expect(document.body).not.toHaveClass(AUTHENTICATED_SHELL_BODY_CLASS);
  });

  it('keeps the shell lock while a dialog opens and closes', () => {
    const shell = renderHook(() => useAuthenticatedShellScrollLock());
    const dialog = render(<Dialog open title="Confirm" onClose={() => {}}>Dialog content</Dialog>);
    expect(document.body).toHaveClass(AUTHENTICATED_SHELL_BODY_CLASS);

    dialog.unmount();
    expect(document.body).toHaveClass(AUTHENTICATED_SHELL_BODY_CLASS);
    shell.unmount();
  });

  it('keeps the document stationary while the application page remains the page scroller', () => {
    const baseCss = readFileSync('src/styles/foundation/base.css', 'utf8');
    const shellCss = readFileSync('src/styles/layout/app-shell.css', 'utf8');

    expect(baseCss).toMatch(/body\.has-application-shell\s*\{[^}]*overflow:\s*hidden;/);
    expect(shellCss).toMatch(/\.application-shell\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s);
    expect(shellCss).toMatch(/\.application-page\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(shellCss).toMatch(/\.application-page-content\s*\{[^}]*min-height:\s*100%;/s);
  });
});
