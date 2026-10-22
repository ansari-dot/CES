import React from 'react';
import { MessageSquareQuote } from 'lucide-react';

export default function ResultsProgress() {
  const subjects = [
    { name: "Mathematics", score: "92%", grade: "A+", width: "92%" },
    { name: "English", score: "88%", grade: "A", width: "88%" },
    { name: "Science", score: "85%", grade: "A", width: "85%" },
    { name: "Urdu", score: "81%", grade: "B+", width: "81%" },
  ];

  const recent = [
    { title: "Fractions Quiz", subject: "Maths · 18 Oct", score: "18/20", grade: "A" },
    { title: "Essay Draft", subject: "English · 15 Oct", score: "16/20", grade: "B+" },
    { title: "Solar Quiz", subject: "Science · 12 Oct", score: "27/30", grade: "A" },
  ];

  return (
    <div className="space-y-6">
      {/* 3 Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-navy text-white rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold opacity-70 uppercase tracking-wider">Overall Average</div>
          <div className="text-3xl font-headings font-bold mt-1">87%</div>
          <div className="text-xs opacity-75 mt-0.5">Grade A · +2% vs last term</div>
        </div>

        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignments Done</div>
          <div className="text-3xl font-headings font-bold text-foreground mt-1">17/20</div>
          <div className="w-full bg-muted h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full w-[85%]" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</div>
          <div className="text-3xl font-headings font-bold text-foreground mt-1">94%</div>
          <div className="text-xs text-muted-foreground mt-0.5">142 of 151 lessons present</div>
        </div>
      </div>

      {/* Subject Performance Horizontal Bars */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="font-headings font-bold text-base text-foreground mb-4">
          Subject performance
        </div>
        <div className="space-y-4">
          {subjects.map((sub) => (
            <div key={sub.name} className="flex items-center gap-4">
              <span className="w-28 text-sm font-semibold text-foreground">{sub.name}</span>
              <div className="flex-1 bg-muted h-2.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: sub.width }} />
              </div>
              <span className="text-xs font-bold text-foreground w-8 text-right">{sub.score}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-success-bg text-success w-7 text-center">
                {sub.grade}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Results List */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="font-headings font-bold text-base text-foreground mb-3">
          Recent results
        </div>
        <div className="divide-y divide-border">
          {recent.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.subject}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-foreground">{item.score}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-secondary text-primary">
                  {item.grade}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Teacher Quote */}
        <div className="mt-4 bg-muted/60 border border-border rounded-sm p-3.5 flex items-center gap-2.5 text-xs text-foreground">
          <MessageSquareQuote className="w-4 h-4 text-primary shrink-0" />
          <span>“Steady improvement in fractions, Ahmed. Keep practising word problems.” — Mr. Hamza Khan</span>
        </div>
      </div>
    </div>
  );
}
