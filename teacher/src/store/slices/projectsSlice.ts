import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { StudentProject } from '../../types';

interface ProjectsState {
  projects: StudentProject[];
  selectedProjectId: string | null;
}

const initialProjects: StudentProject[] = [
  {
    id: 'PRJ-01',
    title: 'Solar System Scale Models',
    description:
      'Design, compute astronomical scale factors, and build 3D physical or digital models of inner and outer solar system bodies.',
    classId: '4-sci-a',
    className: 'Class 4-A',
    subject: 'Mathematics & Science',
    deadline: 'Nov 02, 2024',
    progressPercent: 75,
    totalGroups: 6,
    pendingReviewCount: 4,
    status: 'active',
    milestones: [
      { id: 'M1', title: 'Planetary Distance Ratios', dueDate: 'Oct 14', completed: true },
      { id: 'M2', title: 'Scale Factor Calculations', dueDate: 'Oct 24', completed: true },
      { id: 'M3', title: 'Final Model Construction', dueDate: 'Nov 02', completed: false },
    ],
  },
  {
    id: 'PRJ-02',
    title: 'Local Climate Action Tracker',
    description:
      'Deploy community micro-sensors to record ambient temperature and humidity shifts across urban school greenspaces.',
    classId: '6-sci-b',
    className: 'Class 6-B',
    subject: 'General Science',
    deadline: 'Nov 12, 2024',
    progressPercent: 92,
    totalGroups: 7,
    pendingReviewCount: 2,
    status: 'active',
    milestones: [
      { id: 'M1', title: 'Sensor Deployment & Calibration', dueDate: 'Oct 10', completed: true },
      { id: 'M2', title: 'Data Intake & Outlier Cleaning', dueDate: 'Oct 23', completed: true },
      { id: 'M3', title: 'Data Synthesis & Presentation', dueDate: 'Nov 12', completed: false },
    ],
  },
  {
    id: 'PRJ-03',
    title: 'Hydraulic Bridge Construction',
    description:
      'Apply Pascal’s law and fluid mechanics to prototype a functional pneumatic/hydraulic lift mechanism.',
    classId: '7-math-c',
    className: 'Class 7-C',
    subject: 'Science Lab',
    deadline: 'Nov 20, 2024',
    progressPercent: 40,
    totalGroups: 5,
    pendingReviewCount: 1,
    status: 'active',
    milestones: [
      { id: 'M1', title: 'Architectural Blueprints', dueDate: 'Oct 28', completed: true },
      { id: 'M2', title: 'Hydraulic Piston Testing', dueDate: 'Nov 08', completed: false },
      { id: 'M3', title: 'Weight Load Stress Test', dueDate: 'Nov 20', completed: false },
    ],
  },
];

const initialState: ProjectsState = {
  projects: initialProjects,
  selectedProjectId: 'PRJ-01',
};

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelectedProjectId: (state, action: PayloadAction<string>) => {
      state.selectedProjectId = action.payload;
    },
    toggleMilestone: (
      state,
      action: PayloadAction<{ projectId: string; milestoneId: string }>
    ) => {
      const proj = state.projects.find((p) => p.id === action.payload.projectId);
      if (proj) {
        const ms = proj.milestones.find((m) => m.id === action.payload.milestoneId);
        if (ms) {
          ms.completed = !ms.completed;
          const completedCount = proj.milestones.filter((m) => m.completed).length;
          proj.progressPercent = Math.round((completedCount / proj.milestones.length) * 100);
        }
      }
    },
    createProject: (state, action: PayloadAction<StudentProject>) => {
      state.projects.unshift(action.payload);
    },
  },
});

export const { setSelectedProjectId, toggleMilestone, createProject } = projectsSlice.actions;
export default projectsSlice.reducer;
