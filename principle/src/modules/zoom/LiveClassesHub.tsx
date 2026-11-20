import React, { useState } from 'react';
import { Video, Sparkles } from 'lucide-react';
import { ZoomLinksModule } from './ZoomLinksModule';
import { MontessoriLiveClasses } from '../montessori/MontessoriLiveClasses';

/**
 * Live Classes / Zoom Management: two clearly separated areas.
 * "Regular Classes" renders the existing Zoom classrooms module unchanged;
 * "Montessori Live Classes" manages scheduled classes for KG sections.
 */
export const LiveClassesHub: React.FC = () => {
  const [area, setArea] = useState<'regular' | 'montessori'>('regular');
  const btn = (value: 'regular' | 'montessori', label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setArea(value)}
      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
        area === value ? 'bg-[#1e1b4b] text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {btn('regular', 'Regular Classes', Video)}
        {btn('montessori', 'Montessori Live Classes', Sparkles)}
      </div>
      {area === 'regular' ? <ZoomLinksModule /> : <MontessoriLiveClasses />}
    </div>
  );
};
