'use client';

import Image from 'next/image';

interface ArcaLogoProps {
  className?: string;
  size?: number;
  width?: number;
  height?: number;
}

export function ArcaLogo({ className = "", size = 40, width, height }: ArcaLogoProps) {
  return (
    <Image
      src="/arca-logo2.png"
      alt="Arca Logo"
      width={width || size}
      height={height || size}
      className={className}
      priority
    />
  );
}
