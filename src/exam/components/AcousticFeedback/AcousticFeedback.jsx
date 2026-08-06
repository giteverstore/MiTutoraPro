import { AUDIO_STATUS } from '../../detectors/AudioDetector';

const checks = [
  ['Speech', [AUDIO_STATUS.CANDIDATE_SPEAKING, AUDIO_STATUS.OTHER_SPEAKER_ESTIMATED, AUDIO_STATUS.CONTINUOUS_CONVERSATION]],
  ['Background noise', [AUDIO_STATUS.LOUD_BACKGROUND_NOISE]],
  ['Music / media', [AUDIO_STATUS.MUSIC_ESTIMATED, AUDIO_STATUS.MEDIA_PLAYBACK_ESTIMATED]],
  ['Keyboard', [AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED]],
  ['Microphone health', [AUDIO_STATUS.MUTED, AUDIO_STATUS.DISCONNECTED, AUDIO_STATUS.ZERO_INPUT, AUDIO_STATUS.SATURATED, AUDIO_STATUS.UNAVAILABLE]],
];
export function AcousticFeedback({ audio }) {
  return <section className="acoustic-feedback exam-card" aria-labelledby="acoustic-feedback-title" aria-live="polite">
    <header><span>Local acoustic analysis</span><h3 id="acoustic-feedback-title">Audio integrity check</h3><p>Speak briefly, type several keys, and check your room audio to verify detection feedback.</p></header>
    <div>{checks.map(([label, statuses]) => <span className={statuses.includes(audio.status) ? 'is-detected' : ''} key={label}><strong>{label}</strong><small>{statuses.includes(audio.status) ? 'Detected' : 'Listening'}</small></span>)}</div>
    <p>{audio.message}</p>
  </section>;
}
