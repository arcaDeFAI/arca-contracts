interface TokenPairLogosProps {
  token0Logo: string;
  token1Logo: string;
  size?: number;
}

export function TokenPairLogos({ token0Logo, token1Logo, size = 24 }: TokenPairLogosProps) {
  return (
    <div className="flex items-center" style={{ width: size * 1.6 }}>
      <img 
        src={token0Logo} 
        alt="Token 0" 
        className="rounded-full"
        style={{ 
          width: size, 
          height: size,
          filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.08)) drop-shadow(0 3px 8px rgba(0,0,0,0.22))',
          position: 'relative',
          zIndex: 2
        }}
      />
      <img 
        src={token1Logo} 
        alt="Token 1" 
        className="rounded-full"
        style={{ 
          width: size, 
          height: size,
          marginLeft: -size * 0.3,
          filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.08)) drop-shadow(0 3px 8px rgba(0,0,0,0.22))',
          position: 'relative',
          zIndex: 1
        }}
      />
    </div>
  );
}
