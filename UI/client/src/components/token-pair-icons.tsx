interface TokenPairIconsProps {
  tokens: string[];
}

const getTokenColor = (token: string): string => {
  const colors: Record<string, string> = {
    'ETH': 'bg-gray-500',
    'scUSD': 'bg-gray-500',
    'ANON': 'bg-gray-500',
    'S': 'bg-gray-500',
  };
  return colors[token] || 'bg-gray-500';
};

const getTokenInitial = (token: string): string => {
  return token.charAt(0).toUpperCase();
};

export default function TokenPairIcons({ tokens }: TokenPairIconsProps) {
  if (tokens.length < 2) return null;

  return (
    <div className="relative flex items-center">
      <div className={`w-10 h-10 ${getTokenColor(tokens[0])} rounded-full border-2 border-arca-bg flex items-center justify-center z-10`}>
        <span className="text-white font-bold text-sm">{getTokenInitial(tokens[0])}</span>
      </div>
      <div className={`w-10 h-10 ${getTokenColor(tokens[1])} rounded-full border-2 border-arca-bg flex items-center justify-center -ml-3`}>
        <span className="text-white font-bold text-sm">{getTokenInitial(tokens[1])}</span>
      </div>
    </div>
  );
}
