'use client';

import Image from 'next/image';

interface ArcaLogoProps {
  className?: string;
  size?: number;
}

export function ArcaLogo({ className = "", size = 40 }: ArcaLogoProps) {
  return (
    <Image
      src="/arca-logo.png"
      alt="Arca Logo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
