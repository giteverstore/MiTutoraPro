import { useEffect, useState } from 'react';

function getInitials(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';
}

function isImageUrl(value) {
  return /^(https?:|blob:|data:image\/)/i.test(String(value ?? '').trim());
}

export function UserAvatar({ avatar, name, className = '' }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatar]);

  const showImage = isImageUrl(avatar) && !imageFailed;
  const fallback = avatar && !isImageUrl(avatar) ? avatar : getInitials(name);

  return (
    <span className={className} aria-hidden="true">
      {showImage ? (
        <img
          className="profile-avatar-image"
          src={avatar}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : fallback}
    </span>
  );
}
