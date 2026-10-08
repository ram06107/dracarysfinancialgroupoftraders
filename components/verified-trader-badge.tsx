import Image from "next/image";

export function VerifiedTraderBadge({ compact = false }: { compact?: boolean }) {
  return <span className={`verified-trader-badge${compact ? " verified-trader-badge-compact" : ""}`} title="DRACARYS verified financial trader" aria-label="DRACARYS verified financial trader">
    <Image className="verified-trader-stamp" src="/verified-trader-seal.png" alt="" width={1188} height={1187} unoptimized aria-hidden="true" />
    <span className="verified-trader-label">Verified trader</span>
  </span>;
}
