import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';
import { PREVIEW_MESSAGE_TYPE } from '../compiler/runtimes/preview/previewDocument.js';

export function PreviewPanel({ preview, height, collapsed, onExpand, onToggleCollapsed, executionStatus }) {
  const iframeRef = useRef(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [messages, setMessages] = useState([]);

  useEffect(() => { setMessages([]); setActiveTab('preview'); }, [preview?.channel]);
  useEffect(() => {
    const receive = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.type !== PREVIEW_MESSAGE_TYPE || message.channel !== preview?.channel) return;
      if (message.kind === 'console') setMessages((current) => [...current, { level: message.level, text: message.message }]);
      if (message.kind === 'error') {
        setMessages((current) => [...current, { level: 'error', text: message.message }]);
        setActiveTab('console');
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [preview?.channel]);

  const selectTab = (tab) => { setActiveTab(tab); onExpand?.(); };
  return <section className={`web-preview-panel ide-results${collapsed ? ' is-collapsed' : ''}`} style={{ height, flexBasis: height }}>
    <div className="ide-result-tabs" role="tablist" aria-label="Web preview results">
      <button className={activeTab === 'preview' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === 'preview'} onClick={() => selectTab('preview')}>Preview</button>
      <button className={activeTab === 'console' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === 'console'} onClick={() => selectTab('console')}>Console{messages.length ? <span>{messages.length}</span> : null}</button>
      <button className="output-panel-toggle" type="button" aria-label={collapsed ? 'Restore preview panel' : 'Minimize preview panel'} onClick={onToggleCollapsed}>
        {collapsed ? <ChevronUp size={ICON_SIZE.sm} aria-hidden="true" /> : <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" />}
      </button>
    </div>
    {!collapsed ? activeTab === 'preview' ? (
      preview?.srcDoc ? <iframe ref={iframeRef} title="Learner web preview" sandbox="allow-scripts" srcDoc={preview.srcDoc} /> : <div className="web-preview-empty">{executionStatus === 'running' ? 'Preparing preview…' : 'Run your code to open the preview.'}</div>
    ) : (
      <div className="ide-result-terminal" role="tabpanel" tabIndex="0"><pre><code>{messages.length ? messages.map(({ level, text }) => `[${level}] ${text}`).join('\n') : 'No preview console messages.'}</code></pre></div>
    ) : null}
  </section>;
}
