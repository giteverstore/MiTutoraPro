import { useEffect, useState } from 'react';

function percent(value) { return `${Math.round((value ?? 0) * 100)}%`; }
function Sparkline({ values, label }) { const points = values.map((value, index) => `${index * (120 / Math.max(1, values.length - 1))},${32 - value * 30}`).join(' '); return <svg viewBox="0 0 120 34" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg>; }
export function DeveloperCalibrationPanel({ vision, onTune }) {
  if (!import.meta.env.DEV) return null;
  const audio = vision.detectors?.audio?.details ?? {};
  const phone = vision.detectors?.phone?.details ?? {};
  const objects = vision.detectors?.objects?.details ?? {};
  const phoneEvidence = phone.evidence;
  const objectEvidence = objects.evidence;
  const audioDiagnostics = audio.diagnostics ?? {};
  const [history, setHistory] = useState([]);
  useEffect(() => { if (audio.speechProbability === undefined) return; setHistory((current) => [...current.slice(-39), { speech: audio.speechProbability ?? 0, noise: audio.noiseProbability ?? 0, floor: Math.min(1, (audio.noiseFloor ?? 0) * 10), confidence: audio.confidence ?? 0 }]); }, [audio.speechProbability, audio.noiseProbability, audio.noiseFloor, audio.confidence]);
  const calibration = audioDiagnostics.calibration ?? {};
  return <aside className="exam-card developer-calibration" aria-label="Developer detector calibration">
    <header><strong>Detector calibration</strong><span>Development only</span></header>
    <div className="developer-calibration-grid">
      <section><h3>Audio / Silero VAD</h3><dl><div><dt>Pipeline</dt><dd>{audio.pipelineState ?? 'UNINITIALIZED'}</dd></div><div><dt>Microphone state</dt><dd>{audio.pipelineState === 'READY' ? 'Connected' : audio.pipelineState ?? 'Initializing'}</dd></div><div><dt>Audio health</dt><dd>{audio.audioHealth ?? 'INITIALIZING'}</dd></div><div><dt>Audio activity</dt><dd>{audio.audioActivity ?? 'UNKNOWN'}</dd></div><div><dt>Audio quality</dt><dd>{audio.audioHealth === 'READY' ? 'Valid' : 'Unavailable'}</dd></div><div><dt>Acoustic state</dt><dd>{audio.vadState ?? 'INITIALIZING'}</dd></div><div><dt>Sample rate</dt><dd>{audioDiagnostics.sampleRate ?? '—'}</dd></div><div><dt>Microphone</dt><dd>{audioDiagnostics.deviceLabel || '—'}</dd></div><div><dt>Speech probability</dt><dd>{percent(audio.speechProbability)}</dd></div><div><dt>Noise floor</dt><dd>{(audio.noiseFloor ?? 0).toFixed(4)}</dd></div><div><dt>Ambient level</dt><dd>{(audio.ambientLevel ?? 0).toFixed(4)}</dd></div><div><dt>Conversation</dt><dd>{audio.conversationDuration ?? 0} ms</dd></div><div><dt>Music likelihood</dt><dd>{percent(audio.musicLikelihood)}</dd></div><div><dt>Typing likelihood</dt><dd>{percent(audio.typingLikelihood)}</dd></div><div><dt>Transient detected</dt><dd>{audio.transientDetected ? 'YES' : 'NO'}</dd></div><div><dt>Transient suppressed</dt><dd>{audio.transientSuppressed ? 'YES' : 'NO'}</dd></div><div><dt>Typing evidence duration</dt><dd>{audio.typingEvidenceDuration ?? 0} ms</dd></div><div><dt>Typing confidence</dt><dd>{percent(audio.typingConfidence)}</dd></div><div><dt>Typing persistence</dt><dd>{audio.typingPersistent ? 'ACTIVE' : 'PENDING'}</dd></div><div><dt>Current audio classification</dt><dd>{audio.vadState ?? 'INITIALIZING'}</dd></div><div><dt>Inference latency</dt><dd>{audioDiagnostics.latency ?? 0} ms</dd></div><div><dt>Recovery attempts</dt><dd>{audioDiagnostics.recoveryAttempts ?? 0}</dd></div></dl>
        <div className="calibration-graphs"><Sparkline values={history.map((item) => item.speech)} label="Speech probability history" /><Sparkline values={history.map((item) => item.floor)} label="Noise floor history" /><Sparkline values={history.map((item) => item.confidence)} label="Confidence history" /></div>
        {onTune ? <div className="calibration-controls">{[['speechConfidence', 'Speech'], ['musicConfidence', 'Music'], ['typingConfidence', 'Typing']].map(([key, label]) => <label key={key}>{label}<input type="range" min="0" max="1" step="0.01" value={calibration[key] ?? 0.5} onChange={(event) => onTune({ [key]: Number(event.target.value) })} /><span>{percent(calibration[key] ?? 0.5)}</span></label>)}</div> : null}
      </section>
      <section><h3>Vision / EfficientDet</h3><dl><div><dt>Detected objects</dt><dd>{objectEvidence?.labels?.join(', ') ?? 'None'}</dd></div><div><dt>Bounding box</dt><dd>{objectEvidence?.metadata?.boundingBox ? JSON.stringify(objectEvidence.metadata.boundingBox) : 'None'}</dd></div><div><dt>Phone confidence</dt><dd>{percent(phone.confidence)}</dd></div><div><dt>Detector confidence</dt><dd>{percent(objectEvidence?.confidence)}</dd></div><div><dt>Stability</dt><dd>{percent(phone.stability)}</dd></div><div><dt>Persistence</dt><dd>{phone.duration ?? 0} ms</dd></div><div><dt>Lost frames</dt><dd>{phoneEvidence?.metadata?.lostFrames ?? 0}</dd></div><div><dt>Inference FPS</dt><dd>{phoneEvidence?.metadata?.inferenceFps ?? objectEvidence?.metadata?.inferenceFps ?? 0}</dd></div></dl></section>
    </div>
  </aside>;
}
