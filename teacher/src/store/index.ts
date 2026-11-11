import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import authReducer from './slices/authSlice';
import timetableReducer from './slices/timetableSlice';
import attendanceReducer from './slices/attendanceSlice';
import tasksReducer from './slices/tasksSlice';
import projectsReducer from './slices/projectsSlice';
import resourcesReducer from './slices/resourcesSlice';
import performanceReducer from './slices/performanceSlice';
import noticesReducer from './slices/noticesSlice';
import dutyReducer from './slices/dutySlice';
import uiReducer from './slices/uiSlice';
import schoolTimetableReducer from './slices/schoolTimetableSlice';
import chatReducer from './slices/chatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    timetable: timetableReducer,
    schoolTimetable: schoolTimetableReducer,
    attendance: attendanceReducer,
    tasks: tasksReducer,
    projects: projectsReducer,
    resources: resourcesReducer,
    performance: performanceReducer,
    notices: noticesReducer,
    duty: dutyReducer,
    ui: uiReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
