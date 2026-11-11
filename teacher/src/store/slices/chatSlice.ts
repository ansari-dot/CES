import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatApi, ChatThreadItem, ChatMessageItem, TaughtSubject } from '../../services/chatApi';

export interface ChatState {
  threads: ChatThreadItem[];
  taughtSubjects: TaughtSubject[];
  activeThreadId: number | null;
  messagesByThread: Record<number, ChatMessageItem[]>;
  isTypingByThread: Record<number, boolean>;
  onlineUserIds: Record<number, boolean>;
  policyWarning: string | null;
  isLoadingThreads: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  totalUnreadCount: number;
  error: string | null;
}

const initialState: ChatState = {
  threads: [],
  taughtSubjects: [],
  activeThreadId: null,
  messagesByThread: {},
  isTypingByThread: {},
  onlineUserIds: {},
  policyWarning: null,
  isLoadingThreads: false,
  isLoadingMessages: false,
  isSending: false,
  totalUnreadCount: 0,
  error: null
};

export const fetchThreadsThunk = createAsyncThunk(
  'chat/fetchThreads',
  async (params: { classId?: number; isArchived?: boolean } | undefined, { rejectWithValue }) => {
    try {
      const data = await chatApi.getThreads(params);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch conversations');
    }
  }
);

export const fetchMessagesThunk = createAsyncThunk(
  'chat/fetchMessages',
  async (threadId: number, { rejectWithValue }) => {
    try {
      const data: any = await chatApi.getMessages(threadId);
      const list = Array.isArray(data.messages)
        ? data.messages
        : Array.isArray(data.messages?.items)
        ? data.messages.items
        : [];
      return { threadId, messages: list, thread: data.thread };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch messages');
    }
  }
);

export const sendMessageThunk = createAsyncThunk(
  'chat/sendMessage',
  async ({ threadId, content }: { threadId: number; content: string }, { rejectWithValue }) => {
    try {
      const data = await chatApi.sendMessage(threadId, content);
      return { threadId, message: data.message, policyWarning: data.policyWarning };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to send message');
    }
  }
);

export const markReadThunk = createAsyncThunk(
  'chat/markRead',
  async (threadId: number, { rejectWithValue }) => {
    try {
      await chatApi.markRead(threadId);
      return threadId;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to mark as read');
    }
  }
);

export const createThreadThunk = createAsyncThunk(
  'chat/createThread',
  async (payload: { classId: number; subjectId: number; targetStudentId: number }, { rejectWithValue }) => {
    try {
      const thread = await chatApi.createThread(payload);
      return thread;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to start conversation');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveThread(state, action: PayloadAction<number | null>) {
      state.activeThreadId = action.payload;
      state.policyWarning = null;
      if (action.payload) {
        // Optimistically clear unread on selection
        const thread = state.threads.find((t) => t.id === action.payload);
        if (thread && thread.teacher_unread_count > 0) {
          state.totalUnreadCount = Math.max(0, state.totalUnreadCount - thread.teacher_unread_count);
          thread.teacher_unread_count = 0;
        }
      }
    },
    clearPolicyWarning(state) {
      state.policyWarning = null;
    },
    receiveSocketMessage(
      state,
      action: PayloadAction<{ threadId: number; message: ChatMessageItem; senderRole: string; senderUserId: number }>
    ) {
      const { threadId, message, senderRole } = action.payload;
      if (!state.messagesByThread[threadId]) {
        state.messagesByThread[threadId] = [];
      }
      // Deduplicate
      const exists = state.messagesByThread[threadId].some((m) => m.id === message.id);
      if (!exists) {
        state.messagesByThread[threadId].push(message);
      }

      // Update thread preview
      const thread = state.threads.find((t) => t.id === threadId);
      if (thread) {
        thread.last_message_preview = message.content;
        thread.last_message_at = message.created_at;
        if (senderRole === 'STUDENT' && state.activeThreadId !== threadId) {
          thread.teacher_unread_count = (thread.teacher_unread_count || 0) + 1;
          state.totalUnreadCount += 1;
        }
      }
    },
    setTypingStatus(state, action: PayloadAction<{ threadId: number; isTyping: boolean }>) {
      const { threadId, isTyping } = action.payload;
      state.isTypingByThread[threadId] = isTyping;
    },
    receiveReadReceipt(state, action: PayloadAction<{ threadId: number; readByRole: string }>) {
      const { threadId, readByRole } = action.payload;
      if (readByRole === 'STUDENT' && state.messagesByThread[threadId]) {
        state.messagesByThread[threadId].forEach((m) => {
          if (m.sender_role === 'TEACHER' && !m.read_at) {
            m.read_at = new Date().toISOString();
          }
        });
      }
    },
    updateUserPresence(state, action: PayloadAction<{ userId: number; isOnline: boolean }>) {
      const { userId, isOnline } = action.payload;
      state.onlineUserIds[userId] = isOnline;
    },
    setBulkPresence(state, action: PayloadAction<Record<number, boolean>>) {
      state.onlineUserIds = { ...state.onlineUserIds, ...action.payload };
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchThreads
      .addCase(fetchThreadsThunk.pending, (state) => {
        state.isLoadingThreads = true;
        state.error = null;
      })
      .addCase(fetchThreadsThunk.fulfilled, (state, action) => {
        state.isLoadingThreads = false;
        state.threads = action.payload.threads || [];
        state.taughtSubjects = action.payload.taughtSubjects || [];
        state.totalUnreadCount = (action.payload.threads || []).reduce(
          (acc, t) => acc + (t.teacher_unread_count || 0),
          0
        );
      })
      .addCase(fetchThreadsThunk.rejected, (state, action) => {
        state.isLoadingThreads = false;
        state.error = action.payload as string;
      })

      // fetchMessages
      .addCase(fetchMessagesThunk.pending, (state) => {
        state.isLoadingMessages = true;
      })
      .addCase(fetchMessagesThunk.fulfilled, (state, action) => {
        state.isLoadingMessages = false;
        state.messagesByThread[action.payload.threadId] = action.payload.messages;
      })
      .addCase(fetchMessagesThunk.rejected, (state, action) => {
        state.isLoadingMessages = false;
        state.error = action.payload as string;
      })

      // sendMessage
      .addCase(sendMessageThunk.pending, (state) => {
        state.isSending = true;
      })
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        state.isSending = false;
        const { threadId, message, policyWarning } = action.payload;
        if (!state.messagesByThread[threadId]) {
          state.messagesByThread[threadId] = [];
        }
        const exists = state.messagesByThread[threadId].some((m) => m.id === message.id);
        if (!exists) {
          state.messagesByThread[threadId].push(message);
        }
        if (policyWarning) {
          state.policyWarning = policyWarning;
        }

        const thread = state.threads.find((t) => t.id === threadId);
        if (thread) {
          thread.last_message_preview = message.content;
          thread.last_message_at = message.created_at;
        }
      })
      .addCase(sendMessageThunk.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload as string;
      })

      // markRead
      .addCase(markReadThunk.fulfilled, (state, action) => {
        const threadId = action.payload;
        const thread = state.threads.find((t) => t.id === threadId);
        if (thread && thread.teacher_unread_count > 0) {
          state.totalUnreadCount = Math.max(0, state.totalUnreadCount - thread.teacher_unread_count);
          thread.teacher_unread_count = 0;
        }
      })

      // createThread
      .addCase(createThreadThunk.fulfilled, (state, action) => {
        const newThread = action.payload;
        const exists = state.threads.some((t) => t.id === newThread.id);
        if (!exists) {
          state.threads.unshift(newThread);
        }
        state.activeThreadId = newThread.id;
      });
  }
});

export const {
  setActiveThread,
  clearPolicyWarning,
  receiveSocketMessage,
  setTypingStatus,
  receiveReadReceipt,
  updateUserPresence,
  setBulkPresence
} = chatSlice.actions;

export default chatSlice.reducer;

