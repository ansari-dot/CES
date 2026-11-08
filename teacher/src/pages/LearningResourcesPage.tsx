import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedType, toggleResourcePublishThunk, deleteResourceThunk } from '../store/slices/resourcesSlice';
import { addToast } from '../store/slices/uiSlice';
import { CreateResourceModal } from '../components/resources/CreateResourceModal';
import { openProtectedFile } from '../services/api';
import {
  BookOpen,
  Upload,
  Search,
  FolderOpen,
  FileText,
  Video,
  Presentation,
  Link2,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const LearningResourcesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const resources = useAppSelector((state) => state.resources.resources);
  const selectedType = useAppSelector((state) => state.resources.selectedType);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (selectedClassId !== 'all' && res.classId !== selectedClassId) return false;
      if (selectedType !== 'all' && res.type !== selectedType) return false;
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        return res.title.toLowerCase().includes(q) || res.subject.toLowerCase().includes(q) || res.className.toLowerCase().includes(q);
      }
      return true;
    });
  }, [resources, selectedClassId, selectedType, filterQuery]);

  const handleTogglePublish = async (id: string, title: string, publish: boolean) => {
    const result = await dispatch(toggleResourcePublishThunk({ id, isPublished: publish }));
    if (toggleResourcePublishThunk.fulfilled.match(result)) {
      dispatch(addToast({ message: `"${title}" is now ${publish ? 'visible to students' : 'hidden from students'}.`, type: 'info' }));
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to update resource.'), type: 'error' }));
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? Students will no longer be able to access it.`)) return;
    const result = await dispatch(deleteResourceThunk(id));
    if (deleteResourceThunk.fulfilled.match(result)) {
      dispatch(addToast({ message: `"${title}" deleted.`, type: 'info' }));
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to delete resource.'), type: 'error' }));
    }
  };

  const handleOpen = async (url: string, fileName?: string) => {
    try {
      await openProtectedFile(url, fileName);
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Unable to open this resource.', type: 'error' }));
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-600" />;
      case 'slides':
        return <Presentation className="w-4 h-4 text-amber-600" />;
      case 'recording':
        return <Video className="w-4 h-4 text-purple-600" />;
      case 'notes':
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <Link2 className="w-4 h-4 text-indigo-600" />;
    }
  };

  // Metrics
  const totalResources = resources.length;
  const pdfCount = resources.filter((r) => r.type === 'pdf').length;
  const recordingsCount = resources.filter((r) => r.type === 'recording').length;
  const slidesCount = resources.filter((r) => r.type === 'slides' || r.type === 'notes').length;

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 bg-[#f6f7fb] min-h-screen p-3 sm:p-5 lg:p-6 rounded-2xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <BookOpen className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Academic Materials &amp; Media
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Student Portal Repository
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Learning Materials &amp; Resources
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Upload syllabus handouts, lecture slides, recorded Zoom videos, and practice worksheets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4.5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 self-start md:self-auto cursor-pointer active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Resources */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>All Types</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalResources}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Total Materials Uploaded
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* PDF Documents */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-rose-100/80 hover:border-rose-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-rose-50 text-rose-700 border-rose-100">
              <span>Documents</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight leading-tight">
              {pdfCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              PDF Handouts &amp; Worksheets
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(244, 63, 94, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Zoom Recordings */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>Class Recordings</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-800 tracking-tight leading-tight">
              {recordingsCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Recorded Zoom Lectures
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Slides & Notes */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Presentation className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Presentations</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight leading-tight">
              {slidesCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Lecture Slides &amp; Notes
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTER & SEARCH TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'pdf', 'slides', 'recording', 'notes'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => dispatch(setSelectedType(type))}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer capitalize whitespace-nowrap ${
                selectedType === type
                  ? 'bg-[#36348e] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {type === 'all' ? 'All Files' : type}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. RESOURCES TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 w-12 text-center">Type</th>
                <th className="px-5 py-2 min-w-[220px]">Resource Details</th>
                <th className="px-5 py-2 w-28">Class</th>
                <th className="px-5 py-2 w-32">Subject</th>
                <th className="px-5 py-2 w-24">Size</th>
                <th className="px-5 py-2 w-28">Uploaded</th>
                <th className="px-5 py-2 text-center w-28">Status</th>
                <th className="px-5 py-2 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FolderOpen className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-xs text-slate-700">No learning resources found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Upload a file or change filters above.</p>
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/80 h-14 transition-colors">
                    <td className="px-5 py-2 text-center">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
                        {renderTypeIcon(res.type)}
                      </div>
                    </td>

                    <td className="px-5 py-2">
                      <span className="font-bold text-slate-900 block">{res.title}</span>
                      <span className="text-[11px] text-slate-400 truncate block max-w-[280px]">
                        {res.description || 'No description provided'}
                      </span>
                    </td>

                    <td className="px-5 py-2">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200">
                        {res.className}
                      </span>
                    </td>

                    <td className="px-5 py-2 font-semibold text-slate-700">{res.subject}</td>

                    <td className="px-5 py-2 font-mono text-slate-500 text-xs">{res.fileSize || '—'}</td>

                    <td className="px-5 py-2 text-slate-500 font-mono text-xs">{res.uploadDate}</td>

                    <td className="px-5 py-2 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          res.isPublished
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {res.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>

                    <td className="px-5 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(res.id, res.title, !res.isPublished)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title={res.isPublished ? 'Unpublish' : 'Publish'}
                        >
                          {res.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(res.id, res.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete resource"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpen(res.fileUrl, res.fileName)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#36348e] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-[0.98]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateResourceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
