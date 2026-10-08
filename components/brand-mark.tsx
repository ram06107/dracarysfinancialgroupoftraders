import Image from "next/image";

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={small ? "brand-mark brand-mark-small" : "brand-mark"}
    >
      <Image src="/dracarys-mark.png" alt="" width={1120} height={665} />
    </span>
  );
}
