"use client";

import { type CSSProperties, useMemo, useState } from "react";

type UserAvatarProps = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  photoURL?: string | null;
  className?: string;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "User").trim();
  const parts = source.includes("@") ? [source[0]] : source.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

const avatarColors = [
  "#2f6fed",
  "#8f7cff",
  "#3ddc97",
  "#f6c85f",
  "#ff8f70",
  "#d783ff",
  "#4fd1c5",
  "#ef5da8",
];

function getAvatarColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % avatarColors.length;
  }
  return avatarColors[hash];
}

export function UserAvatar({ id, name, email, photoURL, className = "" }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getInitials(name, email);
  const seed = id || email || name || initials;
  const style = useMemo(
    () => ({ "--avatar-color": getAvatarColor(seed) }) as CSSProperties,
    [seed],
  );

  if (photoURL && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className={`user-avatar ${className}`}
        onError={() => setImageFailed(true)}
        src={photoURL}
      />
    );
  }

  return (
    <span className={`user-avatar initials-avatar ${className}`} style={style}>
      {initials}
    </span>
  );
}
