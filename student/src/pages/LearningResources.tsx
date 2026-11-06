import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Search, Play, FileText, Monitor, Link as LinkIcon, Filter, LayoutGrid } from 'lucide-react';
import { RootState } from '../store';
import { setSearchQuery, setSelectedSubject, ResourceItem } from '../store/slices/resourcesSlice';
import { setToast } from '../store/slices/studentSlice';
import { openProtectedFile } from '../services/api';
import { LoadingBlock } from '../components/common/LoadingBlock';

export default function LearningResources() {
  const dispatch = useDispatch();
  const { items, searchQuery, selectedSubject, loading } = useSelector((state: RootState) => state.resources);

  const subjects = ['All', ...Array.from(new Set(items.map((i) => i.subject).filter(Boolean))).sort()];

  const filteredItems = items.filter((item) => {
    const matchSubject = selectedSubject === 'All' || item.subject === selectedSubject;
    const matchQuery = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       item.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchQuery;
  });

  if (loading && items.length === 0) {
    return <LoadingBlock message="Loading learning resources..." />;
  }

  const getIcon = (iconType: ResourceItem['iconType']) => {
    switch (iconType) {
      case 'video':
        return <Play className="w-4 h-4 text-primary fill-primary/20" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-primary" />;
      case 'slides':
        return <Monitor className="w-4 h-4 text-primary" />;
      case 'link':
        return <LinkIcon className="w-4 h-4 text-primary" />;
      default:
        return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  const handleAction = async (item: ResourceItem) => {
    if (!item.fileUrl) {
      dispatch(setToast('This resource has no file attached.'));
      return;
    }
    // Videos and external links open in a new tab; everything else is downloaded
    const shouldDownload = item.iconType !== 'video' && item.iconType !== 'link';
    try {
      await openProtectedFile(item.fileUrl, item.fileName, shouldDownload);
    } catch (err: any) {
      dispatch(setToast(err.message || 'Unable to open this resource.'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedSubject}
            onChange={(e) => dispatch(setSelectedSubject(e.target.value))}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm font-medium text-foreground focus:outline-none shadow-sm cursor-pointer"
          >
            {subjects.map(s => <option key={s} value={s}>{s === 'All' ? 'All subjects' : s}</option>)}
          </select>

          <button className="flex items-center gap-1.5 bg-card border border-border rounded-md px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted cursor-pointer">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span>Type</span>
          </button>
          <button
            className="p-2 bg-card border border-border rounded-md text-foreground shadow-sm hover:bg-muted cursor-pointer"
            aria-label="Grid layout view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resource Cards Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredItems.map((res) => (
            <div key={res.id} className="bg-card border border-border rounded-md p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition">
              <div>
                <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center mb-4">
                  {getIcon(res.iconType)}
                </div>
                <div className="font-headings font-bold text-base text-foreground mb-1 line-clamp-1">
                  {res.title}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {res.subject} · {res.teacher}
                  {res.description && <div className="mt-1 line-clamp-2">{res.description}</div>}
                  <div className="mt-0.5 text-[11px] text-muted-foreground/80">{res.details}</div>
                </div>
              </div>
              <button
                onClick={() => handleAction(res)}
                className="w-full py-2 border border-primary/20 bg-secondary/50 hover:bg-secondary text-primary rounded-sm text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>
                  {res.iconType === 'video' ? 'Open' : res.iconType === 'link' ? 'Open Link' : 'Download'}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md p-10 text-center text-muted-foreground">
          No learning materials found matching your filters.
        </div>
      )}
    </div>
  );
}
