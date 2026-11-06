import React from 'react';

interface BrandLoaderProps {
  message?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  message = 'Loading student workspace...',
  subtext = 'Cambridge Education System',
  size = 'md',
  fullScreen = false,
}) => {
  const sizeMap = {
    sm: {
      ring: 'w-16 h-16',
      logo: 'w-8 h-8',
      text: 'text-xs',
      sub: 'text-[10px]',
    },
    md: {
      ring: 'w-24 h-24',
      logo: 'w-12 h-12',
      text: 'text-sm',
      sub: 'text-xs',
    },
    lg: {
      ring: 'w-32 h-32',
      logo: 'w-16 h-16',
      text: 'text-base',
      sub: 'text-xs',
    },
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className="flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-200 font-sans">
      {/* Animated Brand Ring & Glowing Logo Container */}
      <div className="relative flex items-center justify-center mb-4">
        {/* Soft Ambient Glow Aura */}
        <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-[#36348e]/20 via-[#ffc53a]/25 to-indigo-500/20 blur-xl animate-pulse" />

        {/* Outer Cambridge Navy Spinning Orbit */}
        <div
          className={`${currentSize.ring} rounded-full border-[2.5px] border-slate-100 border-t-[#1b1a47] border-r-[#36348e] animate-spin`}
          style={{ animationDuration: '1.2s' }}
        />

        {/* Inner Golden Counter-Rotating Accent Orbit */}
        <div
          className="absolute inset-1 rounded-full border-2 border-transparent border-b-[#c8952b] border-l-[#ffc53a] animate-spin"
          style={{ animationDuration: '2.2s', animationDirection: 'reverse' }}
        />

        {/* Center Logo with Breathing Pulse */}
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <img
            src="/logowb.png"
            alt="Cambridge Education System"
            className={`${currentSize.logo} object-contain drop-shadow-md animate-pulse`}
            style={{ animationDuration: '2s' }}
          />
        </div>
      </div>

      {/* Elegant Typographic Status */}
      {message && (
        <h4 className={`font-bold text-slate-800 ${currentSize.text} tracking-tight leading-snug`}>
          {message}
        </h4>
      )}

      {subtext && (
        <span className={`font-semibold text-[#c8952b] uppercase tracking-wider ${currentSize.sub} mt-1`}>
          {subtext}
        </span>
      )}

      {/* Modern 3-Dot Loading Pulse */}
      <div className="flex items-center gap-1.5 mt-3">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#1b1a47] animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#36348e] animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#c8952b] animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return content;
};

