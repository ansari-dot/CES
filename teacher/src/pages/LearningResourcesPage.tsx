import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedType, togglePublish } from '../store/slices/resourcesSlice';
import { addToast } from '../store/slices/uiSlice';
import { CreateResourceModal } from '../components/resources/CreateResourceModal';

export const LearningResourcesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const resources = useAppSelector((state) => state.resources.resources);
  const selectedType = useAppSelector((state) => state.resources.selectedType);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredResources = resources.filter((res) => {
    if (selectedClassId !== 'all' && res.classId !== selectedClassId) return false;
    if (selectedType !== 'all' && res.type !== selectedType) return false;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      return res.title.toLowerCase().includes(q) || res.subject.toLowerCase().includes(q);
    }
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'picture_as_pdf';
      case 'slides':
        return 'slideshow';
      case 'recording':
        return 'video_camera_front';
      case 'notes':
        return 'description';
      default:
        return 'link';
    }
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#121c2a]">Learning Resources</h1>
          <p className="text-xs text-[#777587]">Upload lecture slides, recorded Zoom videos, and worksheets.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 bg-[#4f46e5] hover:bg-[#3525cd] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">upload_file</span>
          <span>Upload File</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Type pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {['all', 'pdf', 'slides', 'recording', 'notes'].map((type) => (
            <button
              key={type}
              onClick={() => dispatch(setSelectedType(type))}
              className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                selectedType === type
                  ? 'bg-[#3525cd] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#464555] hover:bg-[#dee9fc]'
              }`}
            >
              {type === 'all' ? 'All Files' : type}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-[#777587]">
            search
          </span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#eff4ff] text-xs text-[#121c2a] placeholder:text-[#777587] focus:outline-none"
          />
        </div>
      </div>

      {/* Clean Resources Table (Rows) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                <th className="px-3 w-10 text-center">Type</th>
                <th className="px-3 min-w-[220px]">Resource Title</th>
                <th className="px-3 w-28">Class</th>
                <th className="px-3 w-28">Subject</th>
                <th className="px-3 w-24">Size</th>
                <th className="px-3 w-24">Uploaded</th>
                <th className="px-3 text-center w-24">Status</th>
                <th className="px-3 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#777587]">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">folder_open</span>
                    <p className="font-medium text-xs">No learning resources found.</p>
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50 h-12 transition-colors">
                    <td className="px-3 text-center">
                      <span className="material-symbols-outlined text-[18px] text-[#3525cd]">
                        {getTypeIcon(res.type)}
                      </span>
                    </td>

                    <td className="px-3">
                      <span className="font-bold text-[#121c2a] block">{res.title}</span>
                      <span className="text-[11px] text-[#777587] truncate block max-w-[280px]">
                        {res.description}
                      </span>
                    </td>

                    <td className="px-3 font-bold text-[#3525cd]">
                      <span className="px-2 py-0.5 rounded bg-[#eff4ff] border border-indigo-100">
                        {res.className}
                      </span>
                    </td>

                    <td className="px-3 text-[#464555] font-semibold">{res.subject}</td>

                    <td className="px-3 font-mono text-[#777587]">{res.fileSize || '—'}</td>

                  <td className="px-3 text-[#777587]">{res.uploadDate}</td>

                  <td className="px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        res.isPublished
                          ? 'bg-emerald-100 text-[#065f46]'
                          : 'bg-slate-100 text-[#777587]'
                      }`}
                    >
                      {res.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>

                  <td className="px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          dispatch(togglePublish(res.id));
                          dispatch(
                            addToast({
                              message: `Toggled publication for "${res.title}"`,
                              type: 'info',
                            })
                          );
                        }}
                        className="p-1 text-[#464555] hover:text-[#121c2a] hover:bg-[#eff4ff] rounded transition-colors"
                        title={res.isPublished ? 'Unpublish' : 'Publish'}
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          {res.isPublished ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          dispatch(addToast({ message: `Accessing ${res.fileUrl}`, type: 'info' }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] font-bold text-[11px] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Open
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
