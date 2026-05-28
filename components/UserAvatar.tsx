"use client";

import { useState } from "react";

type UserAvatarProps = {
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

export function UserAvatar({ name, email, photoURL, className = "" }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getInitials(name, email);

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

  return <span className={`user-avatar initials-avatar ${className}`}>{initials}</span>;
}
