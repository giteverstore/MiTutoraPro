import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, LoaderCircle } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

const REGISTER_ORDER = [
  'rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rsp', 'rbp',
  'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'rip',
];
const FLAG_ORDER = ['cf', 'pf', 'af', 'zf', 'sf', 'of'];

function decimalValue(hex) {
  try { return BigInt(hex).toString(10); } catch { return '—'; }
}

function RegisterGrid({ emulator }) {
  const changed = new Set(emulator?.changedRegisters ?? []);
  return <>
    <div className="emulator-register-grid">
      {REGISTER_ORDER.map((name) => <div className={changed.has(name) ? 'is-changed' : ''} key={name}>
        <strong>{name.toUpperCase()}</strong>
        <code>{emulator?.registers?.[name] ?? '0x0000000000000000'}</code>
        <span>{decimalValue(emulator?.registers?.[name])}</span>
      </div>)}
    </div>
    <div className="emulator-flags" aria-label="CPU flags">
      {FLAG_ORDER.map((name) => <span className={emulator?.flags?.[name] ? 'is-set' : ''} key={name}>
        {name.toUpperCase()} <strong>{emulator?.flags?.[name] ? '1' : '0'}</strong>
      </span>)}
    </div>
  </>;
}

function StackView({ emulator }) {
  const bytes = emulator?.stack?.bytes ?? [];
  const rsp = (() => { try { return BigInt(emulator?.stack?.rsp ?? 0); } catch { return 0n; } })();
  const rows = Array.from({ length: Math.ceil(bytes.length / 16) }, (_, index) => ({
    address: `0x${(rsp + BigInt(index * 16)).toString(16).padStart(16, '0').toUpperCase()}`,
    bytes: bytes.slice(index * 16, index * 16 + 16),
  }));
  return <div className="emulator-stack-view">
    <p><strong>RSP</strong> <code>{emulator?.stack?.rsp ?? '—'}</code> · little-endian</p>
    <div className="emulator-stack-table" role="table" aria-label="Stack memory">
      {rows.map((row) => <div role="row" key={row.address}>
        <code role="cell">{row.address}</code>
        <code role="cell">{row.bytes.join(' ')}</code>
      </div>)}
    </div>
  </div>;
}

export function EmulatorResultPanel({ emulator, result, error, isRunning, executionTimeMs, executionStatus, height, collapsed, onExpand, onToggleCollapsed }) {
  const [activeTab, setActiveTab] = useState('registers');
  useEffect(() => { if (error) setActiveTab('output'); }, [error]);
  const status = isRunning ? 'running' : executionStatus;
  const selectTab = (tab) => { setActiveTab(tab); onExpand?.(); };
  return <section className={`emulator-result-panel ide-results is-${status}${collapsed ? ' is-collapsed' : ''}`} style={{ height, flexBasis: height }} aria-live="polite">
    <div className="ide-result-tabs" role="tablist" aria-label="Assembly emulator results">
      {[['registers', 'Registers'], ['stack', 'Stack / Memory'], ['output', 'Output']].map(([tab, label]) => <button className={activeTab === tab ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => selectTab(tab)} key={tab}>{label}</button>)}
      <button className="output-panel-toggle" type="button" aria-label={collapsed ? 'Restore emulator results' : 'Minimize emulator results'} onClick={onToggleCollapsed}>
        {collapsed ? <ChevronUp size={ICON_SIZE.sm} aria-hidden="true" /> : <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" />}
      </button>
    </div>
    {!collapsed ? <div className="emulator-result-content" role="tabpanel" tabIndex="0">
      {isRunning ? <p className="emulator-result-message"><LoaderCircle className="result-spinner" size={ICON_SIZE.sm} aria-hidden="true" /> Assembling and emulating x86-64…</p>
        : activeTab === 'registers' ? <RegisterGrid emulator={emulator} />
          : activeTab === 'stack' ? <StackView emulator={emulator} />
            : <div className="emulator-output"><pre><code>{error || result || 'Run the program to inspect emulator evidence.'}</code></pre></div>}
    </div> : null}
    {!collapsed ? <footer className="ide-result-footer"><div className="ide-runtime-status">
      <span className={`ide-status-dot is-${status}`}>{status === 'running' ? <LoaderCircle className="result-spinner" size={ICON_SIZE.sm} aria-hidden="true" /> : <i aria-hidden="true" />}{status === 'error' ? 'Failed' : status === 'success' ? 'Completed' : status === 'running' ? 'Running' : 'Ready'}</span>
      <span>Instructions <strong>{emulator?.instructionCount ?? '—'}</strong></span>
      <span>Time <strong>{executionTimeMs == null ? '—' : `${executionTimeMs} ms`}</strong></span>
    </div></footer> : null}
  </section>;
}
