import React from 'react';
import { BrandLoader } from './BrandLoader';

export function LoadingBlock({ message = 'Loading records...' }: { message?: string }) {
  return (
    <div className="w-full py-10 flex flex-col items-center justify-center">
      <BrandLoader message={message} subtext="Cambridge Education System" size="sm" />
    </div>
  );
}

