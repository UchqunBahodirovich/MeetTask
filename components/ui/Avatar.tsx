import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  /** Tailwind size classes for the circle, e.g. "w-8 h-8". */
  className?: string;
  /** Font size class for the initials. */
  textClassName?: string;
  title?: string;
}

/** Deterministic colour so a person keeps the same badge everywhere. */
const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

const colourFor = (name: string) => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

/**
 * Shows the person's picture when there is one and it loads. Accounts created
 * through the API have no picture, and a bare <img> with an empty src renders
 * as a broken-image icon — initials are the honest fallback.
 */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  className = 'w-8 h-8',
  textClassName = 'text-[10px]',
  title,
}) => {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      title={title ?? name}
      className={`${className} rounded-full overflow-hidden shrink-0 inline-flex items-center justify-center font-bold ${
        showImage ? 'bg-slate-200' : colourFor(name)
      } ${textClassName}`}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};
