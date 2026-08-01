import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { AuthLayout } from './AuthLayout';
import { AuthButtonLabel } from './AuthButtonLabel';

const avatars = ['🧑‍💻', '🐍', '🚀', '💡'];

export function ProfileCreation({ account, onComplete }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState({
    avatar: avatars[0],
    experienceLevel: 'beginner',
    preferredLanguage: 'English',
    dailyGoalMinutes: 20,
  });

  const updateField = (event) => {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onComplete({
        ...account,
        avatar: profile.avatar,
        learningPreferences: {
          experienceLevel: profile.experienceLevel,
          preferredLanguage: profile.preferredLanguage,
          dailyGoalMinutes: Number(profile.dailyGoalMinutes),
        },
      });
    } catch (authError) {
      setError(authError.message || 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Personalize learning"
      title={`Welcome, ${account.name}`}
      description="Choose preferences that can later tailor course recommendations and pacing."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <fieldset className="avatar-picker">
          <legend>Choose an avatar</legend>
          <div>
            {avatars.map((avatar) => (
              <label className={profile.avatar === avatar ? 'is-selected' : ''} key={avatar}>
                <input type="radio" name="avatar" value={avatar} checked={profile.avatar === avatar} onChange={updateField} />
                <span>{avatar}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="form-field">
          <span>Experience level</span>
          <select className="input-control" name="experienceLevel" value={profile.experienceLevel} onChange={updateField}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="form-field">
          <span>Learning language</span>
          <select className="input-control" name="preferredLanguage" value={profile.preferredLanguage} onChange={updateField}>
            <option>English</option>
            <option>Spanish</option>
            <option>Hindi</option>
          </select>
        </label>
        <label className="form-field">
          <span>Daily goal</span>
          <select className="input-control" name="dailyGoalMinutes" value={profile.dailyGoalMinutes} onChange={updateField}>
            <option value="10">10 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
          </select>
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--primary auth-submit" type="submit" disabled={submitting}>
          <AuthButtonLabel loading={submitting} loadingLabel="Creating account…">
            Start learning <ArrowRight size={ICON_SIZE.base} />
          </AuthButtonLabel>
        </button>
      </form>
    </AuthLayout>
  );
}
