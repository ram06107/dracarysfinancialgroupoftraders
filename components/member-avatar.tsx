import Image from "next/image";

export function MemberAvatar({ name, src, className = "avatar" }: { name: string; src?: string | null; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "M";
  return <span className={`${className}${src ? " avatar-has-image" : ""}`} role="img" aria-label={`${name} profile image`}>
    {src ? <Image src={src} alt="" width={80} height={80} unoptimized /> : initials}
  </span>;
}
