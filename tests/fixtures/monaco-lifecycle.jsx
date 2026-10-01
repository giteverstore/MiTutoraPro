import React from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/editor/editor.api';
import MonacoCodeEditor from '../../src/components/MonacoCodeEditor.jsx';

const root = createRoot(document.getElementById('root'));
const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const uri = (project, path) => `ycoders-project://${project}/${path}`;
const state = { value: '', project: 'project-a', path: 'main.py', retained: [uri('project-a', 'main.py')], mounted: true, language: 'python', scoped: true };

function render() {
  root.render(state.mounted ? <MonacoCodeEditor
    editor={{ ariaLabel: 'Lifecycle editor', language: state.language, modelPath: state.scoped ? uri(state.project, state.path) : undefined }}
    value={state.value}
    onChange={(value) => { state.value = value; }}
    instanceId={`lifecycle-${state.project}`}
    modelOwnerPrefix={state.scoped ? `ycoders-project://${state.project}/` : undefined}
    retainedModelPaths={state.scoped ? state.retained : undefined}
    workspacePreferences={{ fontSize: 16, tabSize: 4, wordWrap: true, monacoTheme: 'ycoders-light' }}
  /> : null);
}

render();
globalThis.monacoLifecycle = {
  async update(next) { Object.assign(state, next); render(); await waitFrame(); },
  async unmount() { state.mounted = false; render(); await waitFrame(); },
  async mount(next = {}) { Object.assign(state, next, { mounted: true }); render(); await waitFrame(); },
  models: () => monaco.editor.getModels().map((model) => model.uri.toString()).sort(),
  modelCount: () => monaco.editor.getModels().length,
  heap: () => performance.memory?.usedJSHeapSize ?? null,
  gc: () => globalThis.gc?.(),
};
