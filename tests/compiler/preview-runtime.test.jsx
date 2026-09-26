import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HtmlPreviewRuntime } from '../../src/compiler/runtimes/preview/HtmlPreviewRuntime.js';
import { ReactPreviewRuntime } from '../../src/compiler/runtimes/preview/ReactPreviewRuntime.js';
import { PreviewPanel } from '../../src/components/PreviewPanel.jsx';

afterEach(cleanup);

describe('web preview runtimes', () => {
  it('builds isolated HTML/CSS preview documents and replaces them on rerun', async () => {
    const runtime = new HtmlPreviewRuntime();
    const first = await runtime.execute({ source: '<style>h1 { color: red; }</style><h1>Hello</h1>' });
    const second = await runtime.execute({ source: '<h1>Again</h1>' });

    expect(first.status).toBe('success');
    expect(first.preview.srcDoc).toContain('h1 { color: red; }');
    expect(first.preview.srcDoc).toContain('<h1>Hello</h1>');
    expect(second.preview.srcDoc).toContain('<h1>Again</h1>');
    expect(second.preview.channel).not.toBe(first.preview.channel);
  });

  it('lets malformed HTML follow browser parsing without crashing the runtime', async () => {
    const result = await new HtmlPreviewRuntime().execute({ source: '<main><h1>Unclosed' });
    expect(result).toEqual(expect.objectContaining({ status: 'success', errors: [] }));
    expect(result.preview.srcDoc).toContain('<main><h1>Unclosed');
  });

  it('uses a script-only iframe sandbox with no same-origin permission', () => {
    render(<PreviewPanel preview={{ channel: 'test', srcDoc: '<h1>Hello</h1>' }} height={240} collapsed={false} executionStatus="success" />);
    const iframe = screen.getByTitle('Learner web preview');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe).toHaveAttribute('srcdoc', '<h1>Hello</h1>');
  });

  it('removes the preview message listener when the panel is disposed', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<PreviewPanel preview={{ channel: 'dispose', srcDoc: '<p>Preview</p>' }} height={240} collapsed={false} executionStatus="success" />);
    unmount();
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    remove.mockRestore();
  });

  it('transforms beginner React, props, state, and effects into an iframe document', async () => {
    const source = `
      import React, { useState, useEffect } from 'react';
      function Greeting({ name }) {
        const [count, setCount] = useState(0);
        useEffect(() => console.log('ready'), []);
        return <button onClick={() => setCount(count + 1)}>Hello {name}: {count}</button>;
      }
      function App() { return <Greeting name="YCoders" />; }
    `;
    const result = await new ReactPreviewRuntime().execute({ source });
    expect(result.errors).toEqual([]);
    expect(result.status).toBe('success');
    expect(result.preview.srcDoc).toContain('ReactDOM.createRoot');
    expect(result.preview.srcDoc).toContain('Hello ');
    expect(result.preview.srcDoc).toContain('YCoders');
    expect(result.preview.srcDoc).toContain('useState');
    expect(result.preview.srcDoc).toContain('useEffect');
  });

  it('supports an explicit ReactDOM bootstrap and interactive event handlers', async () => {
    const result = await new ReactPreviewRuntime().execute({ source: `
      function App() {
        const [count, setCount] = React.useState(0);
        return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
      }
      ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    ` });
    expect(result.status).toBe('success');
    expect(result.preview.srcDoc).toContain('createRoot');
    expect(result.preview.srcDoc).toContain('setCount');
    expect(result.preview.srcDoc).toContain('Count:');
  });

  it('normalizes JSX transform failures and rejects unsupported packages', async () => {
    const runtime = new ReactPreviewRuntime();
    const syntax = await runtime.execute({ source: 'function App() { return <div>; }' });
    const unsupported = await runtime.execute({ source: "import axios from 'axios';\nfunction App(){ return <div />; }" });
    expect(syntax.status).toBe('error');
    expect(syntax.errors[0]).toMatch(/Unexpected token|unterminated|Adjacent|expected/i);
    expect(unsupported).toEqual(expect.objectContaining({ status: 'error' }));
    expect(unsupported.errors[0]).toContain('Unsupported preview import: axios');
  });

  it('captures child console and runtime errors without overriding the parent console', async () => {
    const parentLog = console.log;
    const result = await new HtmlPreviewRuntime().execute({ source: '<script>console.log("inside"); throw new Error("isolated")<\/script>' });
    expect(console.log).toBe(parentLog);
    expect(result.preview.srcDoc).toContain("['log', 'info', 'warn', 'error']");
    expect(result.preview.srcDoc).toContain("addEventListener('error'");
    expect(result.preview.srcDoc).toContain('parent.postMessage');
  });
});
