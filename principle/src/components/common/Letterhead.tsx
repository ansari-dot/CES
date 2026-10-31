import React from 'react';

/**
 * Official Cambridge Education System letterhead, rendered only when printing.
 * Mirrors the school's printed letterhead template: logo top-left and a
 * contact strip (address, phones, email, website) along the bottom.
 */
export const LetterheadHeader: React.FC = () => (
  <div className="hidden print:flex items-center justify-between gap-4 pb-3 mb-4 border-b-2 border-[#36348e]">
    <div className="flex items-center gap-3">
      <img
        src="/logo.jpeg"
        alt="Cambridge Education System logo"
        className="w-16 h-16 object-contain"
      />
      <div className="leading-tight">
        <div className="text-xl font-extrabold tracking-wide text-[#36348e] font-heading">CAMBRIDGE</div>
        <div className="text-xs font-semibold text-slate-700">Education System</div>
        <div className="text-[9px] text-slate-500 tracking-wider">Learn, Grow, Succeed</div>
      </div>
    </div>
    <div className="text-right text-[9px] text-slate-600 leading-relaxed">
      <div>Sector G13-4, Street # 787, House # 60, Islamabad</div>
      <div>+92 300 5118721 · +92 512769073</div>
      <div>info@cambridgeeducation.uk.com</div>
      <div>www.cambridgeeducation.uk.com</div>
    </div>
  </div>
);

export const LetterheadFooter: React.FC = () => (
  <div className="hidden print:flex items-center justify-between gap-4 pt-2 mt-4 border-t-2 border-[#36348e] text-[9px] text-slate-600">
    <span>Sector G13-4, Street # 787, House # 60, Islamabad</span>
    <span>+92 300 5118721 · +92 512769073</span>
    <span>info@cambridgeeducation.uk.com · www.cambridgeeducation.uk.com</span>
  </div>
);
