import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Clock, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import { setFilter, fetchTasks, AssignmentItem } from '../store/slices/assignmentsSlice';
import SubmitAssignmentModal from '../components/dialogs/SubmitAssignmentModal';

export default function Assignments() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, filter } = useSelector((state: RootState) => state.assignments);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);

  useEffect(() => {
    dispatch(fetchTasks());
  }, [dispatch]);

  const pendingCount = items.filter(i => i.status === 'Pending').length;
  const submittedCount = items.filter(i => i.status === 'Submitted').length;
  const gradedCount = items.filter(i => i.status === 'Graded').length;
  const overdueCount = items.filter(i => i.status === 'Overdue').length;

  const filteredItems = items.filter(item => {
    if (filter === 'All') return true;
    return item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Stat Counter Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-sm bg-warning-bg flex items-center justify-center text-warning">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Pending</div>
            <div className="text-xl font-bold font-headings text-foreground">{pendingCount}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-sm bg-info-bg flex items-center justify-center text-info">
            <Send className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Submitted</div>
            <div className="text-xl font-bold font-headings text-foreground">{submittedCount}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-sm bg-success-bg flex items-center justify-center text-success">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Graded</div>
            <div className="text-xl font-bold font-headings text-foreground">{gradedCount}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-sm bg-error-bg flex items-center justify-center text-error">
            <AlertCircle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Overdue</div>
            <div className="text-xl font-bold font-headings text-foreground">{overdueCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['All', 'Pending', 'Submitted', 'Graded'].map((t) => (
          <button
            key={t}
            onClick={() => dispatch(setFilter(t))}
            className={`px-4 py-1.5 rounded-sm text-xs font-bold transition cursor-pointer ${
              filter === t
                ? "bg-primary text-white"
                : "bg-card border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Assignment Items List */}
      <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm overflow-hidden">
        {filteredItems.map((item) => {
          const borderHighlight =
            item.status === 'Pending' ? 'border-l-4 border-l-warning' :
            item.status === 'Submitted' ? 'border-l-4 border-l-info' :
            item.status === 'Graded' ? 'border-l-4 border-l-success' : 'border-l-4 border-l-error';

          return (
            <div key={item.id} className={`p-4 flex items-center gap-4 ${borderHighlight} hover:bg-muted/30 transition`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.subject} · {item.teacher} · {item.dueDate} · {item.marks} marks
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.status === 'Graded' && item.score !== undefined && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm bg-success-bg text-success border border-success/30">
                    {item.score}/{item.marks}
                  </span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  item.status === 'Pending' ? 'bg-warning-bg text-warning' :
                  item.status === 'Submitted' ? 'bg-info-bg text-info' :
                  item.status === 'Graded' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
                }`}>
                  {item.status}
                </span>
              </div>

              <button
                onClick={() => setSelectedAssignment(item)}
                className={`text-xs font-bold px-4 py-1.5 rounded-sm transition cursor-pointer ${
                  item.status === 'Pending'
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                {item.status === 'Pending' ? 'Start' : 'View'}
              </button>
            </div>
          );
        })}
      </div>

      <SubmitAssignmentModal
        isOpen={Boolean(selectedAssignment)}
        onClose={() => setSelectedAssignment(null)}
        assignment={selectedAssignment}
      />
    </div>
  );
}
