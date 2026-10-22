import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { CheckCircle2, Circle, UploadCloud } from 'lucide-react';
import { RootState } from '../store';
import { toggleMilestone } from '../store/slices/assignmentsSlice';
import { setToast } from '../store/slices/studentSlice';

export default function Projects() {
  const dispatch = useDispatch();
  const projects = useSelector((state: RootState) => state.assignments.projects);

  const solar = projects[0];

  const handleUploadMilestone = () => {
    dispatch(setToast("Milestone file uploaded! Teacher notified."));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Main Milestone Active Project */}
        {solar && (
          <div className="bg-card border border-border rounded-md p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-warning-bg text-warning text-xs px-2.5 py-1 rounded-full font-semibold">
                  {solar.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {solar.subject} · {solar.teacher} · {solar.totalMarks} marks
                </span>
              </div>

              <h3 className="font-headings font-bold text-xl text-foreground mb-1">
                {solar.title}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {solar.description}
              </p>

              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                <span>2 of 4 milestones done</span>
                <span>50%</span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden mb-5">
                <div className="bg-primary h-full rounded-full w-1/2" />
              </div>

              <div className="space-y-2.5 mb-6">
                {solar.milestones?.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => dispatch(toggleMilestone({ projectId: solar.id, milestoneId: m.id }))}
                    className="flex items-center gap-2.5 text-xs text-foreground font-medium w-full text-left cursor-pointer hover:opacity-80 transition"
                  >
                    {m.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={m.completed ? 'line-through text-muted-foreground' : ''}>
                      {m.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleUploadMilestone}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload milestone file</span>
            </button>
          </div>
        )}

        {/* Secondary Submitted & Graded Projects */}
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-md p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-info-bg text-info text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Submitted
              </span>
              <span className="text-xs text-muted-foreground">English · Submitted 17 Oct</span>
            </div>
            <div className="font-headings font-bold text-base text-foreground">
              Story Book: My City
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Awaiting teacher review. Receipt #ENG-2041.
            </div>
          </div>

          <div className="bg-card border border-border rounded-md p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="bg-success-bg text-success text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Graded
              </span>
              <span className="font-headings font-bold text-success text-sm">26/30</span>
            </div>
            <div className="font-headings font-bold text-base text-foreground">
              Water Cycle Chart
            </div>
            <div className="bg-muted/60 p-2.5 rounded-sm text-xs text-muted-foreground mt-2 italic">
              “Neat chart, Ahmed! Add labels on arrows next time.”
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
