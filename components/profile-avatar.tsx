"use client";

import Image from "next/image";

export function ProfileAvatar({ name, avatarKey = "monogram", avatarUrl, size = "large" }: { name: string; avatarKey?: string | null; avatarUrl?: string; size?: "large" | "small" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "M";
  const image = avatarUrl ?? (avatarKey?.startsWith("data:image/") ? avatarKey : undefined);
  return (
    <span className={`profile-avatar profile-avatar-${size}`} role="img" aria-label={`${name} profile image`}>
      {image ? <Image src={image} alt="" width={112} height={112} unoptimized /> : avatarKey === "dragon" ? <Image src="/dracarys-mark.png" alt="" width={1120} height={665} /> : <span aria-hidden="true">{initials}</span>}
    </span>
  );
}
