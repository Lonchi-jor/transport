"use client";

import Image from "next/image";

type Props = {
  variant?: "full" | "mark";
  className?: string;
};

export default function BrandLogo({ variant = "full", className = "" }: Props) {
  if (variant === "mark") {
    return (
      <Image
        src="/ccmm-mark.png"
        alt="CCMM"
        width={336}
        height={336}
        className={className || "size-8 rounded-md bg-white object-contain"}
        priority
      />
    );
  }

  return (
    <Image
      src="/ccmm-logo.jpg"
      alt="CCMM — Construction Carrosserie Menuiserie Métallique"
      width={882}
      height={336}
      className={className || "h-auto w-full max-w-[280px] bg-white object-contain"}
      priority
    />
  );
}
