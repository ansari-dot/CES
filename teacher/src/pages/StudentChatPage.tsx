import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchThreadsThunk,
  fetchMessagesThunk,
  sendMessageThunk,
  markReadThunk,
  setActiveThread,
  createThreadThunk,
  clearPolicyWarning,
  setBulkPresence
} from '../store/slices/chatSlice';
import {
  getSocket,
  joinChatThread,
  leaveChatThread,
  sendChatTyping
} from '../services/socketService';
import { chatApi, EnrolledStudent } from '../services/chatApi';
import {
  MessageSquare,
  Search,
  Send,
  Plus,
  Shield,
  AlertTriangle,
  Check,
  CheckCheck,
  User,
  GraduationCap,
  BookOpen,
  X,
  Clock,
  Sparkles
} from 'lucide-react';
import { parseUtcInstant, formatTimeInZone, getBrowserTimeZone, DEFAULT_SCHOOL_TIMEZONE } from '../lib/timezone';

export const StudentChatPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    threads,
    taughtSubjects,
    activeThreadId,
    messagesByThread,
    isTypingByThread,
    onlineUserIds,
    policyWarning,
    isLoadingThreads,
    isLoadingMessages,
    isSending
  } = useAppSelector((state) => state.chat);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const chatTimezone = useAppSelector((state) => (state as any).timetable?.timezone) as string | undefined;
  const assignedClassesFromAuth = teacher?.assignedClasses || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [inputText, setInputText] = useState('');
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const typingTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Combine taught subjects from chat API and assigned classes from auth state
  const allTaughtSubjects = React.useMemo(() => {
    const map = new Map<string, { classId: number; className: string; subjectId: number; subjectName: string; subjectCode: string }>();

    // 1. From chat API
    (taughtSubjects || []).forEach((s) => {
      const cid = Number(s.classId);
      const sid = Number(s.subjectId);
      if (cid && sid) {
        map.set(`${cid}-${sid}`, {
          classId: cid,
          className: s.className || `Class ${cid}`,
          subjectId: sid,
          subjectName: s.subjectName || 'Subject',
          subjectCode: s.subjectCode || ''
        });
      }
    });

    // 2. From Auth state (assignedClasses)
    (assignedClassesFromAuth || []).forEach((c: any) => {
      const cid = Number(c.classId || c.id);
      const sid = Number(c.subjectId || 1);
      if (cid && !map.has(`${cid}-${sid}`)) {
        map.set(`${cid}-${sid}`, {
          classId: cid,
          className: c.className || c.name?.split(' - ')[0] || `Class ${cid}`,
          subjectId: sid,
          subjectName: c.subject || c.subjectName || 'General',
          subjectCode: c.subjectCode || ''
        });
      }
    });

    return Array.from(map.values());
  }, [taughtSubjects, assignedClassesFromAuth]);

  // Unique classes for filter & modal
  const uniqueClasses = React.useMemo(() => {
    return Array.from(
      new Map(allTaughtSubjects.map((item) => [item.classId, item.className])).entries()
    );
  }, [allTaughtSubjects]);

  // New Chat Modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [modalClassId, setModalClassId] = useState<number | ''>('');
  const [modalSubjectId, setModalSubjectId] = useState<number | ''>('');
  const [modalStudents, setModalStudents] = useState<EnrolledStudent[]>([]);
  const [modalSelectedStudentId, setModalSelectedStudentId] = useState<number | ''>('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Initial load
  useEffect(() => {
    dispatch(fetchThreadsThunk());
  }, [dispatch]);

  // Handle active thread change: join socket room, load messages, mark as read, check presence
  useEffect(() => {
    if (activeThreadId) {
      joinChatThread(activeThreadId);
      dispatch(fetchMessagesThunk(activeThreadId));
      dispatch(markReadThunk(activeThreadId));

      // Check peer presence
      const targetThread = threads.find((t) => t.id === activeThreadId);
      if (targetThread?.studentUserId) {
        const s = getSocket();
        s.emit('chat:check_presence', { userIds: [targetThread.studentUserId] }, (res: Record<number, boolean>) => {
          if (res) dispatch(setBulkPresence(res));
        });
      }

      return () => {
        leaveChatThread(activeThreadId);
      };
    }
  }, [activeThreadId, dispatch, threads]);

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const activeMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const isStudentTyping = activeThreadId ? Boolean(isTypingByThread[activeThreadId]) : false;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isStudentTyping]);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 2000) {
      setInputText(text);

      if (activeThreadId) {
        if (!isTypingLocal) {
          setIsTypingLocal(true);
          sendChatTyping(activeThreadId, true);
        }

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          setIsTypingLocal(false);
          sendChatTyping(activeThreadId, false);
        }, 1500);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeThreadId || !inputText.trim() || isSending) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setIsTypingLocal(false);
    sendChatTyping(activeThreadId, false);

    const text = inputText.trim();
    setInputText('');
    await dispatch(sendMessageThunk({ threadId: activeThreadId, content: text }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter and deduplicate threads per student
  const filteredThreads = React.useMemo(() => {
    const uniqueMap = new Map<string, (typeof threads)[0]>();
    for (const t of threads) {
      const key = `${t.class_id}-${t.student_id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, t);
      }
    }
    return Array.from(uniqueMap.values()).filter((t) => {
      const matchesQuery =
        searchQuery.trim() === '' ||
        t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.studentRollNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subjectName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClass =
        selectedClassFilter === 'ALL' || String(t.class_id) === selectedClassFilter;

      return matchesQuery && matchesClass;
    });
  }, [threads, searchQuery, selectedClassFilter]);

  // Open modal & reset with preloaded class and students
  const handleOpenNewChatModal = () => {
    setIsNewChatModalOpen(true);
    setStudentSearch('');
    if (allTaughtSubjects.length > 0) {
      const first = allTaughtSubjects[0];
      setModalClassId(first.classId);
      setModalSubjectId(first.subjectId);
      loadClassStudents(first.classId);
    }
  };

  // Auto-init modal selection if opened
  useEffect(() => {
    if (isNewChatModalOpen && modalClassId === '' && allTaughtSubjects.length > 0) {
      const first = allTaughtSubjects[0];
      setModalClassId(first.classId);
      setModalSubjectId(first.subjectId);
      loadClassStudents(first.classId);
    }
  }, [isNewChatModalOpen, modalClassId, allTaughtSubjects]);

  const loadClassStudents = async (classId: number) => {
    setIsLoadingStudents(true);
    setModalStudents([]);
    setModalSelectedStudentId('');
    try {
      const students = await chatApi.getClassStudents(classId);
      setModalStudents(students || []);
      if (students && students.length > 0) {
        setModalSelectedStudentId(students[0].studentId);
      }
    } catch {
      setModalStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleModalClassChange = (newClassId: number) => {
    setModalClassId(newClassId);
    const sub = allTaughtSubjects.find((s) => s.classId === newClassId);
    if (sub) {
      setModalSubjectId(sub.subjectId);
    }
    loadClassStudents(newClassId);
  };

  const handleStartConversation = async () => {
    if (!modalClassId || !modalSubjectId || !modalSelectedStudentId) return;

    const res = await dispatch(
      createThreadThunk({
        classId: Number(modalClassId),
        subjectId: Number(modalSubjectId),
        targetStudentId: Number(modalSelectedStudentId)
      })
    );

    if (createThreadThunk.fulfilled.match(res)) {
      setIsNewChatModalOpen(false);
      dispatch(setActiveThread(res.payload.id));
    }
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    // Each user sees the same message instant in their own timezone
    const date = parseUtcInstant(isoString);
    return date ? formatTimeInZone(date, chatTimezone || getBrowserTimeZone() || DEFAULT_SCHOOL_TIMEZONE) : '';
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-slate-50 overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs">
      {/* Top Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#191847] to-[#36348e] flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Academic Student Chat</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Live Guidance
              </span>
            </div>
            <p className="text-xs text-slate-500">
              One-on-one academic consultation and homework clarification for your enrolled students.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenNewChatModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#191847] to-[#36348e] hover:from-[#211f5d] hover:to-[#4338ca] text-white text-xs font-semibold rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Student Chat
        </button>
      </div>

      {/* Main Chat Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Conversations List */}
        <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e] text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Class Pill Filters */}
            {uniqueClasses.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  onClick={() => setSelectedClassFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                    selectedClassFilter === 'ALL'
                      ? 'bg-[#191847] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {uniqueClasses.map(([cId, cName]) => (
                  <button
                    key={cId}
                    onClick={() => setSelectedClassFilter(String(cId))}
                    className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                      selectedClassFilter === String(cId)
                        ? 'bg-[#191847] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingThreads ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-[#36348e] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading conversations...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-600">No conversations found</p>
                  <p className="text-slate-400 mt-1">Start a chat with a student using "+ New Student Chat"</p>
                </div>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                const hasUnread = (thread.teacher_unread_count || 0) > 0;

                return (
                  <div
                    key={thread.id}
                    onClick={() => dispatch(setActiveThread(thread.id))}
                    className={`p-3.5 transition cursor-pointer flex items-start gap-3 hover:bg-slate-50/80 ${
                      isActive ? 'bg-[#36348e]/5 border-l-4 border-l-[#36348e]' : ''
                    }`}
                  >
                    {/* Student Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 text-[#191847] font-bold text-xs flex items-center justify-center border border-indigo-200/80 shadow-xs">
                        {thread.studentName
                          ? thread.studentName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : 'S'}
                      </div>
                      {/* Live Online Presence Indicator */}
                      {onlineUserIds[thread.studentUserId] && (
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-400/40"
                          title="Online"
                        />
                      )}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-400/30" />
                      )}
                    </div>

                    {/* Thread Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {thread.studentName}
                        </span>
                        {thread.last_message_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatMessageTime(thread.last_message_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-mono font-medium text-[10px]">
                          Roll #{thread.studentRollNumber || 'N/A'}
                        </span>
                        <span className="truncate text-slate-400">·</span>
                        <span className="truncate font-medium text-indigo-700">
                          {thread.subjectName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 truncate font-normal">
                          {thread.last_message_preview || 'No messages yet'}
                        </p>
                        {hasUnread && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white shrink-0">
                            {thread.teacher_unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center / Right Column: Chat View */}
        <div className="flex-1 flex flex-col bg-[#fbfbfe] h-full overflow-hidden">
          {activeThread ? (
            <>
              {/* Thread Header */}
              <div className="bg-white px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#191847] to-[#36348e] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {activeThread.studentName
                      ? activeThread.studentName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'S'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {activeThread.studentName}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                        Roll #{activeThread.studentRollNumber}
                      </span>
                      {onlineUserIds[activeThread.studentUserId] ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Active Now
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-medium text-[#36348e]">
                        {activeThread.className}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {activeThread.subjectName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {isLoadingMessages ? (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <div className="w-6 h-6 border-2 border-[#36348e] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p>Loading conversation transcript...</p>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#36348e] flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Academic Inquiry Room</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Send a message to clarify homework, lesson topics, or exam preparations.
                    </p>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isTeacher = msg.sender_role === 'TEACHER';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isTeacher ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-xl rounded-2xl px-4 py-2.5 text-xs shadow-xs transition ${
                            isTeacher
                              ? 'bg-gradient-to-r from-[#191847] to-[#36348e] text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                          }`}
                        >
                          {/* Message Content */}
                          <p className="whitespace-pre-wrap break-words leading-relaxed font-sans select-text">
                            {msg.content}
                          </p>

                          {/* Timestamp & Status */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isTeacher ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isTeacher && (
                              <span>
                                {msg.read_at ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-300 inline" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-indigo-300 inline" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing Indicator */}
                {isStudentTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200/60 rounded-xl px-3 py-1.5 w-fit shadow-xs animate-pulse">
                    <span className="font-semibold text-[#191847]">{activeThread.studentName}</span>
                    <span>is typing</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#36348e] rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-[#36348e] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-[#36348e] rounded-full animate-bounce" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <div className="bg-white border-t border-slate-200 p-3.5 shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      placeholder="Type your academic response here (Enter to send, Shift+Enter for new line)..."
                      className="w-full text-xs p-3 pr-24 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e] resize-none text-slate-800 placeholder-slate-400"
                    />

                    <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {inputText.length}/2000
                      </span>
                      <button
                        type="submit"
                        disabled={!inputText.trim() || isSending}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-[#191847] to-[#36348e] hover:from-[#211f5d] hover:to-[#4338ca] text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span>Press Enter to send, Shift+Enter for new line</span>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* No Thread Selected State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/60 shadow-xs">
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-base font-bold text-slate-700">No Conversation Selected</h2>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Select a conversation from the left drawer or start a new inquiry with any enrolled student in your classes.
              </p>
              <button
                onClick={handleOpenNewChatModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#191847] text-white text-xs font-semibold rounded-xl hover:bg-[#252361] transition"
              >
                <Plus className="w-4 h-4" />
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#191847] to-[#36348e] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-indigo-300" />
                <h3 className="text-sm font-bold">Start New Student Conversation</h3>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Select Class */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Your Assigned Class:
                </label>
                <select
                  value={modalClassId}
                  onChange={(e) => handleModalClassChange(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e] text-slate-800"
                >
                  {uniqueClasses.map(([cId, cName]) => (
                    <option key={cId} value={cId}>
                      {cName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Subject Context:
                </label>
                <select
                  value={modalSubjectId}
                  onChange={(e) => setModalSubjectId(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e] text-slate-800"
                >
                  {allTaughtSubjects
                    .filter((s) => s.classId === Number(modalClassId))
                    .map((s) => (
                      <option key={`${s.classId}-${s.subjectId}`} value={s.subjectId}>
                        {s.subjectName} {s.subjectCode ? `(${s.subjectCode})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Select Student */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Enrolled Students:
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {modalStudents.length} available
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name or roll number..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#36348e]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                  {isLoadingStudents ? (
                    <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#36348e] border-t-transparent rounded-full animate-spin" />
                      <span>Loading students...</span>
                    </div>
                  ) : modalStudents.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No active students found in this class
                    </div>
                  ) : (
                    modalStudents
                      .filter(
                        (s) =>
                          s.studentName.toLowerCase().includes(studentSearch.toLowerCase()) ||
                          s.rollNumber?.toLowerCase().includes(studentSearch.toLowerCase())
                      )
                      .map((student) => {
                        const isSelected = modalSelectedStudentId === student.studentId;
                        return (
                          <div
                            key={student.studentId}
                            onClick={() => setModalSelectedStudentId(student.studentId)}
                            className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition ${
                              isSelected
                                ? 'bg-[#36348e]/10 text-[#191847] font-bold border-l-4 border-l-[#36348e]'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{student.studentName}</span>
                            </div>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                              Roll #{student.rollNumber}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!modalSelectedStudentId}
                onClick={handleStartConversation}
                className="px-4 py-2 bg-gradient-to-r from-[#191847] to-[#36348e] text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition"
              >
                Open Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StudentChatPage;

