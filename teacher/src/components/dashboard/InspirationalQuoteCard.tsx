import React, { useState, useEffect } from 'react';
import { Send, BookOpen } from 'lucide-react';

const QUOTES = [
  {
    quote: 'Education is the key to a brighter future.',
    author: '— Keep Going!',
  },
  {
    quote: 'Teaching is the greatest act of optimism.',
    author: '— Colleen Wilcox',
  },
  {
    quote: 'Inspire students to ignite their potential.',
    author: '— Cambridge Faculty',
  },
];

export const InspirationalQuoteCard: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState(0);

  // Auto-rotate quotes every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % QUOTES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const active = QUOTES[currentIdx];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b1a47] via-[#2c2a75] to-[#36348e] p-4 sm:p-4.5 text-white shadow-sm flex flex-col justify-between h-full min-h-[160px] group min-w-0">
      {/* Decorative ambient gradient glow */}
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/25 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Floating 3D Paper Plane & Graphic */}
      <div className="absolute top-3 right-3 pointer-events-none opacity-85 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300">
        <Send className="w-5 h-5 text-white transform -rotate-12 fill-white/20" />
      </div>

      {/* Subtle bottom-right book stack graphic */}
      <div className="absolute bottom-2 right-2.5 pointer-events-none opacity-20">
        <BookOpen className="w-8 h-8 text-indigo-200" />
      </div>

      {/* Content */}
      <div className="relative z-10 pr-5 pt-0.5">
        <h4 className="text-xs sm:text-[13px] font-extrabold leading-snug tracking-tight text-white/95 line-clamp-3">
          {active.quote}
        </h4>
        <p className="text-[11px] font-semibold text-indigo-200/90 mt-1 truncate">
          {active.author}
        </p>
      </div>

      {/* Carousel Dots */}
      <div className="flex items-center gap-1.5 relative z-10 pt-2">
        {QUOTES.map((_, i) => (
          <button
            key={`dot-${i}`}
            onClick={() => setCurrentIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIdx
                ? 'w-5 bg-white'
                : 'w-1.5 bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

