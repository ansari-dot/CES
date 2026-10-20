import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { StudentProject } from '../../types';

interface ProjectsState {
  projects: StudentProject[];
  selectedProjectId: string | null;
}

const initialProjects: StudentProject[] = [];

const initialState: ProjectsState = {
  projects: initialProjects,
  selectedProjectId: null,
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
