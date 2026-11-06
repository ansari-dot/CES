import React, { useState, useEffect } from 'react';
import { datesheetsApi } from '../../services/datesheetsApi';
import {
  ExaminationDateSheet,
  ExamType,
  DateSheetStatus
} from '../../types/datesheet';
import { CreateEditDateSheetModal } from './CreateEditDateSheetModal';
import { DateSheetPreviewModal } from './DateSheetPreviewModal';
import { useToast } from '../../context/ToastContext';
import {
  CalendarDays,
  Plus,
  Search,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
  RefreshCw,
  Printer
} from 'lucide-react';

export const DateSheetsModule: React.FC = () => {
  const toast = useToast();

  const [dateSheets, setDateSheets] = useState<ExaminationDateSheet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExaminationDateSheet | null>(null);
  const [previewItem, setPreviewItem] = useState<ExaminationDateSheet | null>(null);

  useEffect(() => {
    loadDateSheets();
  }, [activeCategory]);

  const loadDateSheets = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const params: any = {};
      if (activeCategory !== 'ALL') {
        params.examType = activeCategory as ExamType;
      }
      const res = await datesheetsApi.getDateSheets(params);
      setDateSheets(res.dateSheets || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load examination date sheets.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (sheet: ExaminationDateSheet) => {
    const nextState = !sheet.is_published;
    try {
      await datesheetsApi.togglePublishStatus(sheet.id, nextState);
      toast.success(
        nextState
          ? `"${sheet.title}" is now PUBLISHED and visible to students & teachers.`
          : `"${sheet.title}" is now HIDDEN from student & teacher dashboards.`
      );
      await loadDateSheets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update visibility status.');
    }
  };

  const handleDelete = async (sheet: ExaminationDateSheet) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${sheet.title}"? All scheduled papers will be removed.`)) {
      return;
    }

    try {
      await datesheetsApi.deleteDateSheet(sheet.id);
      toast.success(`"${sheet.title}" deleted successfully.`);
      await loadDateSheets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete date sheet.');
    }
  };

  const handleOpenPreview = async (sheetId: number) => {
    try {
      const full = await datesheetsApi.getDateSheetById(sheetId);
      setPreviewItem(full);
    } catch (err: any) {
      toast.error(err.message || 'Unable to load timetable details.');
    }
  };

  const handleOpenEdit = async (sheetId: number) => {
    try {
      const full = await datesheetsApi.getDateSheetById(sheetId);
      setEditingItem(full);
      setIsCreateModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Unable to open date sheet for editing.');
    }
  };

  const filteredSheets = dateSheets.filter((ds) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ds.title.toLowerCase().includes(q) ||
        (ds.description && ds.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Counters
  const totalCount = dateSheets.length;
  const publishedCount = dateSheets.filter((ds) => ds.is_published).length;
  const hiddenCount = dateSheets.filter((ds) => ds.status === 'HIDDEN').length;
  const draftCount = dateSheets.filter((ds) => ds.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            Examination Date Sheets &amp; Timetables
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage, publish, hide, and schedule examination timetables for Monthly Tests, Mid-Term, and Final-Term exams.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadDateSheets}
            className="p-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition shadow-2xs"
            title="Refresh date sheets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Date Sheet</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Date Sheets</div>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{totalCount}</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase">Published &amp; Active</div>
          <div className="text-2xl font-black text-emerald-700 mt-0.5">{publishedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Announcements live on portals</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-600 uppercase">Hidden / Paused</div>
          <div className="text-2xl font-black text-amber-700 mt-0.5">{hiddenCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Popup suspended</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Draft Schedules</div>
          <div className="text-2xl font-black text-slate-700 mt-0.5">{draftCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">In preparation</div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Examination Categories Filter Tabs & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Examinations' },
            { id: 'MONTHLY_TEST', label: '1. Monthly Tests' },
            { id: 'MID_TERM', label: '2. Mid-Term Exams' },
            { id: 'FINAL_TERM', label: '3. Final-Term Exams' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-[#1b1a47] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search date sheet title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Date Sheets Table / List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading examination date sheets...</span>
          </div>
        ) : filteredSheets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto stroke-1" />
            <p className="font-semibold text-slate-700">No examination date sheets found</p>
            <p className="text-[11px] text-slate-400">
              Click &quot;+ Create Date Sheet&quot; to author a new examination schedule.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date Sheet Title</th>
                  <th className="py-3 px-3">Exam Category</th>
                  <th className="py-3 px-3">Applicable Classes</th>
                  <th className="py-3 px-3">Total Papers</th>
                  <th className="py-3 px-3">Visibility &amp; Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSheets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1b1a47] text-[13px]">{ds.title}</div>
                      {ds.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                          {ds.description}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          ds.exam_type === 'FINAL_TERM'
                            ? 'bg-purple-100 text-purple-800'
                            : ds.exam_type === 'MID_TERM'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ds.exam_type.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 flex-wrap max-w-xs">
                        {ds.applicable_classes && ds.applicable_classes.length > 0 ? (
                          ds.applicable_classes.map((c) => (
                            <span
                              key={c.id}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md"
                            >
                              {c.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No classes</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-800">
                      {ds.total_exams || 0} Papers
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                          ds.is_published
                            ? 'bg-emerald-100 text-emerald-800'
                            : ds.status === 'HIDDEN'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ds.is_published ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Published (Live)</span>
                          </>
                        ) : ds.status === 'HIDDEN' ? (
                          <>
                            <EyeOff className="w-3 h-3 text-amber-600" />
                            <span>Hidden (Paused)</span>
                          </>
                        ) : (
                          <span>Draft</span>
                        )}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Publish / Hide Toggle Button */}
                        <button
                          onClick={() => handleTogglePublish(ds)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-2xs ${
                            ds.is_published
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          title={ds.is_published ? 'Hide from students & teachers' : 'Publish / Unhide'}
                        >
                          {ds.is_published ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hide</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Publish</span>
                            </>
                          )}
                        </button>

                        {/* Preview Timetable Button */}
                        <button
                          onClick={() => handleOpenPreview(ds.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                          title="Preview Official Timetable"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Preview</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(ds.id)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition"
                          title="Edit Date Sheet"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(ds)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                          title="Delete Date Sheet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <CreateEditDateSheetModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingItem(null);
        }}
        onSaved={loadDateSheets}
        editItem={editingItem}
      />

      {/* Preview Timetable Modal (Matches User's Reference Screenshot) */}
      {previewItem && (
        <DateSheetPreviewModal
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
          dateSheet={previewItem}
        />
      )}
    </div>
  );
};

