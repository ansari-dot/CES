import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  studentChatApi,
  StudentThreadItem,
  AvailableTeacher,
  ChatMessageItem
} from '../services/chatApi';
import {
  getSocket,
  joinChatThread,
  leaveChatThread,
  sendChatTyping
} from '../services/socketService';
import {
  MessageSquare,
  Search,
  Send,
  Shield,
  AlertTriangle,
  Check,
  CheckCheck,
  BookOpen,
  User,
  Sparkles,
  GraduationCap,
  X,
  HelpCircle
} from 'lucide-react';

export default function TeacherChat() {
  const [threads, setThreads] = useState<StudentThreadItem[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [enrollment, setEnrollment] = useState<{ classId: number; className: string; gradeLevel: number } | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTeacherTyping, setIsTeacherTyping] = useState(false);
  const [policyWarning, setPolicyWarning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<Record<number, boolean>>({});

  const typingTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads and available teachers
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await studentChatApi.getThreads();
      setThreads(data.threads || []);
      setAvailableTeachers(data.availableTeachers || []);
      setEnrollment(data.enrollment || null);

      // Select first active thread if available
      if (!activeThreadId && data.threads && data.threads.length > 0) {
        setActiveThreadId(data.threads[0].id);
      }
    } catch (err) {
      console.error('Failed to load chat data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When active thread changes: join socket room, load messages, mark as read, check presence
  useEffect(() => {
    if (!activeThreadId) return;

    joinChatThread(activeThreadId);
    studentChatApi.markRead(activeThreadId).catch(() => {});

    studentChatApi
      .getMessages(activeThreadId)
      .then((res: any) => {
        const msgList = Array.isArray(res.messages)
          ? res.messages
          : Array.isArray(res.messages?.items)
          ? res.messages.items
          : [];
        setMessages(msgList);
        setPolicyWarning(null);
      })
      .catch((err) => console.error(err));

    const s = getSocket();
    const thread = threads.find((t) => t.id === activeThreadId);
    if (thread?.teacherUserId) {
      s.emit('chat:check_presence', { userIds: [thread.teacherUserId] }, (res: Record<number, boolean>) => {
        if (res) setOnlineUserIds((prev) => ({ ...prev, ...res }));
      });
    }

    return () => {
      leaveChatThread(activeThreadId);
    };
  }, [activeThreadId, threads]);

  // Socket listeners for real-time messages & typing & presence
  useEffect(() => {
    const socket = getSocket();

    const onMessage = (data: any) => {
      if (data?.threadId === activeThreadId && data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }

      // Update thread preview in sidebar
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === data.threadId) {
            return {
              ...t,
              last_message_preview: data.message.content,
              last_message_at: data.message.created_at,
              student_unread_count:
                data.senderRole === 'TEACHER' && activeThreadId !== data.threadId
                  ? (t.student_unread_count || 0) + 1
                  : t.student_unread_count
            };
          }
          return t;
        })
      );
    };

    const onTyping = (data: any) => {
      if (data?.threadId === activeThreadId) {
        setIsTeacherTyping(Boolean(data.isTyping));
      }
    };

    const onRead = (data: any) => {
      if (data?.threadId === activeThreadId && data?.readByRole === 'TEACHER') {
        setMessages((prev) =>
          prev.map((m) => (m.sender_role === 'STUDENT' ? { ...m, read_at: data.readAt } : m))
        );
      }
    };

    const onPresence = (data: any) => {
      if (data?.userId !== undefined) {
        setOnlineUserIds((prev) => ({
          ...prev,
          [data.userId]: Boolean(data.isOnline)
        }));
      }
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:user_typing', onTyping);
    socket.on('chat:read', onRead);
    socket.on('chat:presence', onPresence);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:user_typing', onTyping);
      socket.off('chat:read', onRead);
      socket.off('chat:presence', onPresence);
    };
  }, [activeThreadId]);

  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTeacherTyping]);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 2000) {
      setInputText(text);

      if (activeThreadId) {
        sendChatTyping(activeThreadId, true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          sendChatTyping(activeThreadId, false);
        }, 1500);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeThreadId || !inputText.trim() || isSending) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendChatTyping(activeThreadId, false);

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const res = await studentChatApi.sendMessage(activeThreadId, text);
      if (res?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.message.id)) return prev;
          return [...prev, res.message];
        });
      }
      if (res?.policyWarning) {
        setPolicyWarning(res.policyWarning);
      }
    } catch (err: any) {
      console.error('Failed to send message', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Open or create a conversation with an assigned subject teacher
  const handleSelectTeacher = async (teacher: AvailableTeacher) => {
    // Check if thread already exists for this subject + teacher
    const existing = threads.find(
      (t) => t.subject_id === teacher.subjectId && t.teacher_id === teacher.teacherId
    );

    if (existing) {
      setActiveThreadId(existing.id);
      return;
    }

    try {
      const newThread = await studentChatApi.createThread({
        classId: teacher.classId,
        subjectId: teacher.subjectId,
        targetTeacherId: teacher.teacherId
      });

      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
    } catch (err) {
      console.error('Failed to create thread', err);
    }
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Unified and deduplicated faculty list for conversation sidebar
  const filteredTeachers = useMemo(() => {
    const list: AvailableTeacher[] = [];
    const seen = new Set<string>();

    // 1. Existing threads first (with conversation history)
    for (const th of threads) {
      const key = `${th.teacher_id}-${th.subject_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          classId: th.class_id,
          teacherId: th.teacher_id,
          teacherName: th.teacherName,
          teacherDesignation: th.teacherDesignation,
          subjectId: th.subject_id,
          subjectName: th.subjectName,
          subjectCode: ''
        });
      }
    }

    // 2. Assigned subject teachers not yet in a conversation thread
    for (const t of availableTeachers) {
      const key = `${t.teacherId}-${t.subjectId}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(t);
      }
    }

    // Filter by search query
    return list.filter(
      (t) =>
        t.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subjectName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [threads, availableTeachers, searchQuery]);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-slate-50 overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs">
      {/* Top Banner */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#191847] to-[#36348e] flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ask Your Teacher</h1>
              {enrollment && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {enrollment.className}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Direct academic questions, homework guidance, and concept clarification with your subject teachers.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Subject Faculty List */}
        <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
          {/* Search Bar */}
          <div className="p-3.5 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search teacher or subject..."
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
          </div>

          {/* Teacher Subject Cards */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-[#36348e] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading your subject teachers...</p>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-600">No subject teachers assigned</p>
                <p className="text-[11px] text-slate-400">
                  Teachers assigned to your active class will appear here.
                </p>
              </div>
            ) : (
              filteredTeachers.map((teacher) => {
                const thread = threads.find(
                  (t) => t.subject_id === teacher.subjectId && t.teacher_id === teacher.teacherId
                );
                const isActive = thread && thread.id === activeThreadId;
                const unreadCount = thread?.student_unread_count || 0;

                return (
                  <div
                    key={`${teacher.teacherId}-${teacher.subjectId}`}
                    onClick={() => handleSelectTeacher(teacher)}
                    className={`p-3.5 transition cursor-pointer flex items-start gap-3 hover:bg-slate-50 ${
                      isActive ? 'bg-[#36348e]/5 border-l-4 border-l-[#36348e]' : ''
                    }`}
                  >
                    {/* Teacher Initial Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#191847] to-[#36348e] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {teacher.teacherName
                          ? teacher.teacherName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : 'T'}
                      </div>
                      {/* Live Teacher Presence Indicator */}
                      {thread?.teacherUserId && onlineUserIds[thread.teacherUserId] && (
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-400/40"
                          title="Online"
                        />
                      )}
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-400/30" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {teacher.teacherName}
                        </span>
                        {thread?.last_message_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatMessageTime(thread.last_message_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                        <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-semibold rounded text-[10px]">
                          {teacher.subjectName}
                        </span>
                        {teacher.teacherDesignation && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="truncate text-slate-400 text-[10px]">
                              {teacher.teacherDesignation}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 truncate font-normal">
                          {thread?.last_message_preview || 'Click to ask a question'}
                        </p>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white shrink-0">
                            {unreadCount}
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

        {/* Right Side: Conversation Area */}
        <div className="flex-1 flex flex-col bg-[#fbfbfe] h-full overflow-hidden">
          {activeThread ? (
            <>
              {/* Active Conversation Header */}
              <div className="bg-white px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#191847] to-[#36348e] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {activeThread.teacherName
                      ? activeThread.teacherName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'T'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {activeThread.teacherName}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                        {activeThread.subjectName}
                      </span>
                      {activeThread.teacherUserId && onlineUserIds[activeThread.teacherUserId] ? (
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
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span>{activeThread.teacherDesignation || 'Subject Faculty'}</span>
                      <span className="mx-1.5">·</span>
                      <span className="text-[#36348e] font-medium">{activeThread.className}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#36348e] flex items-center justify-center mx-auto">
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Need help with {activeThread.subjectName}?
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Ask your teacher about homework questions, upcoming tests, or specific chapter topics.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isStudent = msg.sender_role === 'STUDENT';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-xl rounded-2xl px-4 py-2.5 text-xs shadow-xs transition ${
                            isStudent
                              ? 'bg-gradient-to-r from-[#191847] to-[#36348e] text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words leading-relaxed font-sans select-text">
                            {msg.content}
                          </p>

                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isStudent ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isStudent && (
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

                {/* Teacher Typing Indicator */}
                {isTeacherTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200/60 rounded-xl px-3 py-1.5 w-fit shadow-xs animate-pulse">
                    <span className="font-semibold text-[#191847]">{activeThread.teacherName}</span>
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
                      placeholder={`Ask ${activeThread.teacherName} a question regarding ${activeThread.subjectName} (Enter to send)...`}
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
                    <span>Press Enter to send</span>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/60 shadow-xs">
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-base font-bold text-slate-700">Select a Subject Teacher</h2>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose one of your enrolled subjects from the list on the left to start asking your teacher questions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

