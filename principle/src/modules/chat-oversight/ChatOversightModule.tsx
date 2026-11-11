import React, { useState, useEffect } from 'react';
import {
  principalChatApi,
  PrincipalThreadItem,
  ChatMessageItem,
  PrincipalOversightData
} from '../../services/chatApi';
import {
  Shield,
  AlertTriangle,
  MessageSquare,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  User,
  GraduationCap,
  X,
  FileText,
  RefreshCw,
  Lock
} from 'lucide-react';

export const ChatOversightModule: React.FC = () => {
  const [data, setData] = useState<PrincipalOversightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasViolationsOnly, setHasViolationsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected thread for inspection
  const [inspectedThreadId, setInspectedThreadId] = useState<number | null>(null);
  const [inspectedThread, setInspectedThread] = useState<PrincipalThreadItem | null>(null);
  const [inspectedMessages, setInspectedMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const loadOversightData = async () => {
    setIsLoading(true);
    try {
      const res = await principalChatApi.getOversight({
        hasViolationsOnly: hasViolationsOnly || undefined
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load oversight data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOversightData();
  }, [hasViolationsOnly]);

  const handleInspect = async (thread: PrincipalThreadItem) => {
    setInspectedThreadId(thread.id);
    setInspectedThread(thread);
    setIsLoadingMessages(true);
    try {
      const res: any = await principalChatApi.getThreadMessages(thread.id);
      const msgList = Array.isArray(res.messages)
        ? res.messages
        : Array.isArray(res.messages?.items)
        ? res.messages.items
        : [];
      setInspectedMessages(msgList);
    } catch (err) {
      console.error('Failed to load thread messages', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const closeInspection = () => {
    setInspectedThreadId(null);
    setInspectedThread(null);
    setInspectedMessages([]);
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter items by client-side search
  const filteredItems = (data?.items || []).filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.studentName.toLowerCase().includes(q) ||
      item.teacherName.toLowerCase().includes(q) ||
      item.className.toLowerCase().includes(q) ||
      item.subjectName.toLowerCase().includes(q) ||
      (item.studentRollNumber && item.studentRollNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#191847] to-[#36348e] text-white flex items-center justify-center shadow-md">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Academic Chat Oversight & Compliance
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Audited & Enforced
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Read-only institutional audit trail for student-faculty academic messaging under Cambridge safety guidelines.
            </p>
          </div>
        </div>

        <button
          onClick={loadOversightData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Active Conversations</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {data?.metrics.totalThreads ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Exchanged Messages</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {data?.metrics.totalMessages ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              (data?.metrics.totalViolations ?? 0) > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Masked Policy Violations</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">
                {data?.metrics.totalViolations ?? 0}
              </span>
              {(data?.metrics.totalViolations ?? 0) > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                  DLP Enforced
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student, teacher, class or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e] text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHasViolationsOnly(!hasViolationsOnly)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
              hasViolationsOnly
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Violations Only</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3.5 px-4">Class & Subject</th>
                <th className="py-3.5 px-4">Teacher</th>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4 text-center">Messages</th>
                <th className="py-3.5 px-4">Safety Status</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4 text-right">Oversight Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-[#36348e] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading institutional oversight records...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Shield className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                    <p className="font-semibold text-slate-600">No conversation threads found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {hasViolationsOnly
                        ? 'No policy violations detected among ongoing conversations.'
                        : 'Active student-teacher conversations will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const hasViolations = item.violationCount > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      {/* Class & Subject */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.className}</div>
                        <div className="text-[11px] text-[#36348e] font-medium">
                          {item.subjectName}
                        </div>
                      </td>

                      {/* Teacher */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{item.teacherName}</div>
                        <div className="text-[10px] text-slate-400">Faculty Member</div>
                      </td>

                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{item.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Roll #{item.studentRollNumber || 'N/A'}
                        </div>
                      </td>

                      {/* Messages Count */}
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                        {item.totalMessages}
                      </td>

                      {/* Safety Status */}
                      <td className="py-3.5 px-4">
                        {hasViolations ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{item.violationCount} Masked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Compliant</span>
                          </span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {formatMessageTime(item.last_message_at || undefined)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleInspect(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#191847] text-white hover:bg-[#252361] rounded-lg transition active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Thread</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Read-Only Inspection Drawer Modal */}
      {inspectedThread && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slideLeft">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#191847] to-[#36348e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Read-Only Conversation Audit</h2>
                  <p className="text-[11px] text-indigo-200">
                    Thread ID #{inspectedThread.id} · {inspectedThread.className} · {inspectedThread.subjectName}
                  </p>
                </div>
              </div>
              <button
                onClick={closeInspection}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audit Log Warning Notice */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 text-slate-600 text-[11px] shrink-0">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>
                Read-only inspection mode. This view action is permanently recorded in the institutional audit log.
              </span>
            </div>

            {/* Participants Summary Card */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Faculty</div>
                <div className="font-bold text-slate-900 mt-0.5">{inspectedThread.teacherName}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Student</div>
                <div className="font-bold text-slate-900 mt-0.5">{inspectedThread.studentName}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Roll #{inspectedThread.studentRollNumber}
                </div>
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fbfbfe]">
              {isLoadingMessages ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-[#36348e] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading conversation transcript...</p>
                </div>
              ) : inspectedMessages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No messages have been sent in this thread yet.
                </div>
              ) : (
                inspectedMessages.map((msg) => {
                  const isTeacher = msg.sender_role === 'TEACHER';
                  const hasViolation = Boolean(msg.was_masked || msg.has_policy_violation);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isTeacher ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] font-bold text-slate-500 mb-1 px-1">
                        {isTeacher ? `Teacher (${inspectedThread.teacherName})` : `Student (${inspectedThread.studentName})`}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                          isTeacher
                            ? 'bg-[#191847] text-white rounded-br-xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                        }`}
                      >
                        {hasViolation && (
                          <div
                            className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded ${
                              isTeacher
                                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Safety Violation: Phone Number Detected & Masked</span>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words leading-relaxed select-text font-sans">
                          {msg.content}
                        </p>

                        <div
                          className={`mt-1 text-[10px] text-right ${
                            isTeacher ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {formatMessageTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {inspectedMessages.length} total messages in thread
              </span>
              <button
                onClick={closeInspection}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatOversightModule;

