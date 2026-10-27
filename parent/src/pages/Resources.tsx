import React, { useState } from 'react';
import { Search, Play, FileText, Monitor, Link as LinkIcon } from 'lucide-react';
import { useChildData, useParent } from '../context/ParentContext';
import { openProtectedFile } from '../services/api';
import { RequireChild, LoadingBlock, ErrorBlock, EmptyBlock } from '../components/common';
import { formatDate } from '../lib/format';

interface ResourceRow {
  id: number;
  title: string;
  description: string | null;
  subjectName: string;
  resourceType: string;
  fileUrl: string;
  fileName: string | null;
  fileSize: string | null;
  uploadedByName: string;
  createdAt: string;
}

const ICONS: Record<string, React.ElementType> = {
  RECORDING: Play,
  SLIDES: Monitor,
  LINK: LinkIcon,
};

function ResourcesContent() {
  const { showToast } = useParent();
  const { data, loading, error, reload } = useChildData<ResourceRow[]>((id) => `/api/v1/parents/me/children/${id}/resources`);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('All');

  if (loading && !data) return <LoadingBlock message="Loading learning resources…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const items = data || [];
  const subjects = ['All', ...Array.from(new Set(items.map((i) => i.subjectName))).sort()];

  const filtered = items.filter(
    (r) =>
      (subject === 'All' || r.subjectName === subject) &&
      (r.title.toLowerCase().includes(query.toLowerCase()) || r.subjectName.toLowerCase().includes(query.toLowerCase()))
  );

  const open = async (r: ResourceRow) => {
    try {
      await openProtectedFile(r.fileUrl, r.fileName || undefined);
    } catch (err: any) {
      showToast(err.message || 'Unable to open this resource', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-2 text-sm font-medium text-foreground focus:outline-none shadow-sm cursor-pointer"
        >
          {subjects.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All subjects' : s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="No learning resources" description="Materials published by your child's teachers will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const Icon = ICONS[r.resourceType] || FileText;
            return (
              <div key={r.id} className="bg-card border border-border rounded-md p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition">
                <div>
                  <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center mb-4">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="font-headings font-bold text-base text-foreground mb-1 line-clamp-1">{r.title}</div>
                  <div className="text-xs text-muted-foreground mb-4">
                    {r.subjectName} · {r.uploadedByName}
                    {r.description && <div className="mt-1 line-clamp-2">{r.description}</div>}
                    <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {[r.resourceType, r.fileSize, `Uploaded ${formatDate(r.createdAt)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => open(r)}
                  className="w-full py-2 border border-primary/20 bg-secondary/50 hover:bg-secondary text-primary rounded-sm text-xs font-bold transition cursor-pointer"
                >
                  {r.resourceType === 'LINK' ? 'Open Link' : 'Open / Download'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Resources() {
  return (
    <RequireChild>
      <ResourcesContent />
    </RequireChild>
  );
}
