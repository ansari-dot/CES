import { configureStore } from '@reduxjs/toolkit';
import studentReducer from './slices/studentSlice';
import classesReducer from './slices/classesSlice';
import assignmentsReducer from './slices/assignmentsSlice';
import resourcesReducer from './slices/resourcesSlice';
import feesReducer from './slices/feesSlice';
import attendanceReducer from './slices/attendanceSlice';
import notificationsReducer from './slices/notificationsSlice';

export const store = configureStore({
  reducer: {
    student: studentReducer,
    classes: classesReducer,
    assignments: assignmentsReducer,
    resources: resourcesReducer,
    fees: feesReducer,
    attendance: attendanceReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
