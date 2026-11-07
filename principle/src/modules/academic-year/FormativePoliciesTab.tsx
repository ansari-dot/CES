import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  History,
  PlusCircle,
  Play,
  Layers,
  Percent,
  TrendingUp,
  Shield
} from 'lucide-react';

interface FormativePoliciesTabProps {
  year: { id: number; name: string; status: string };
}

export const FormativePoliciesTab: React.FC<FormativePoliciesTabProps> = ({ year }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [activePolicy, setActivePolicy] = useState<any | null>(null);
  const [policyHistory, setPolicyHistory] = useState<any[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form fields
  const [policyName, setPolicyName] = useState('Standard Formative Continuous Policy');
  const [scope, setScope] = useState<'GLOBAL' | 'SESSION'>('SESSION');
  const [version, setVersion] = useState('v1.1.0');
  const [monthlyWeight, setMonthlyWeight] = useState(40);
  const [quizWeight, setQuizWeight] = useState(20);
  const [midTermWeight, setMidTermWeight] = useState(30);
  const [homeworkWeight, setHomeworkWeight] = useState(10);

  const [critThreshold, setCritThreshold] = useState(40);
  const [attnThreshold, setAttnThreshold] = useState(60);
  const [goodThreshold, setGoodThreshold] = useState(75);
  const [exclThreshold, setExclThreshold] = useState(90);

  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const [active, history] = await Promise.all([
        api.getActiveGradingPolicy(year.id).catch(() => null),
        api.listGradingPolicies({ sessionId: year.id }).catch(() => ({ data: [] }))
      ]);
      setActivePolicy(active);
      setPolicyHistory(Array.isArray(history?.data) ? history.data : Array.isArray(history) ? history : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load grading policies');
    } finally {
      setLoading(false);
    }
  }, [year.id, toast]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const totalWeights = Number(monthlyWeight) + Number(quizWeight) + Number(midTermWeight) + Number(homeworkWeight);
  const isWeightValid = Math.round(totalWeights * 100) / 100 === 100;
  const isThresholdValid =
    critThreshold < attnThreshold &&
    attnThreshold < goodThreshold &&
    goodThreshold < exclThreshold;

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) {
      toast.error('Weights must sum exactly to 100.00%');
      return;
    }
    if (!isThresholdValid) {
      toast.error('Alert thresholds must satisfy: Critical < Attention < Good Standing < Excellent');
      return;
    }

    try {
      setActionLoading(true);
      await api.createGradingPolicy({
        policy_name: policyName,
        scope,
        session_id: scope === 'SESSION' ? year.id : null,
        version,
        monthly_test_weight: monthlyWeight,
        quiz_weight: quizWeight,
        mid_term_weight: midTermWeight,
        homework_weight: homeworkWeight,
        critical_risk_threshold: critThreshold,
        attention_threshold: attnThreshold,
        good_standing_threshold: goodThreshold,
        excellent_threshold: exclThreshold,
        status: 'ACTIVE',
        effective_from: new Date().toISOString().split('T')[0]
      });
      toast.success('New continuous grading policy activated successfully');
      setCreateModal(false);
      await loadPolicies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create grading policy');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      setActionLoading(true);
      await api.activateGradingPolicy(id);
      toast.success('Grading policy activated');
      await loadPolicies();
    } catch (err: any) {
      toast.error(err.message || 'Activation failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading formative grading policies..." />;
  }

  return (
    <div className="space-y-6">
      {/* Informational Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold tracking-wide uppercase mb-2">
              <Shield className="w-3.5 h-3.5" />
              Continuous Performance Engine
            </div>
            <h2 className="text-xl font-bold tracking-tight">Academic Grading Policies &amp; Thresholds</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Configures the dynamic normalization formative weights and alert thresholds used for continuous student progress monitoring. 
              <strong> Crucial Architecture Rule:</strong> Terminal examination marks have 0% weight in this monitoring score, 
              and continuous formative scores do not influence formal Terminal Class Promotion decisions.
            </p>
          </div>

          <button
            onClick={() => setCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold flex items-center gap-1.5 self-start md:self-auto shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Configure New Policy
          </button>
        </div>
      </div>

      {/* ACTIVE POLICY DISPLAY */}
      {activePolicy ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{activePolicy.policy_name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60 uppercase">
                  Active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                  {activePolicy.scope} · {activePolicy.version}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Effective from: {String(activePolicy.effective_from).split('T')[0]}
              </p>
            </div>
          </div>

          {/* Formative Weights Cards */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Formative Assessment Component Weights (Sum = 100%)
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <div className="text-[11px] font-semibold text-indigo-700 uppercase">Monthly Tests</div>
                <div className="text-2xl font-black text-indigo-950 mt-1">
                  {Number(activePolicy.monthly_test_weight)}%
                </div>
                <div className="text-[10px] text-indigo-500 mt-0.5">Regular monthly syllabus tests</div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="text-[11px] font-semibold text-blue-700 uppercase">Class Quizzes</div>
                <div className="text-2xl font-black text-blue-950 mt-1">
                  {Number(activePolicy.quiz_weight)}%
                </div>
                <div className="text-[10px] text-blue-500 mt-0.5">Frequent formative pop quizzes</div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100">
                <div className="text-[11px] font-semibold text-purple-700 uppercase">Mid-Term Assessment</div>
                <div className="text-2xl font-black text-purple-950 mt-1">
                  {Number(activePolicy.mid_term_weight)}%
                </div>
                <div className="text-[10px] text-purple-500 mt-0.5">Mid-year diagnostic evaluation</div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="text-[11px] font-semibold text-amber-700 uppercase">Homework &amp; Tasks</div>
                <div className="text-2xl font-black text-amber-950 mt-1">
                  {Number(activePolicy.homework_weight)}%
                </div>
                <div className="text-[10px] text-amber-500 mt-0.5">Submitted assignments &amp; tasks</div>
              </div>
            </div>
          </div>

          {/* Intervention Thresholds Hierarchy */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Intervention &amp; Alert Risk Thresholds
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50">
                <div className="font-bold text-rose-800 flex items-center justify-between">
                  <span>Critical Risk</span>
                  <span className="text-rose-600 font-mono text-sm">&lt; {activePolicy.critical_risk_threshold}%</span>
                </div>
                <div className="text-[11px] text-rose-600 mt-1">Immediate intervention trigger</div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                <div className="font-bold text-amber-800 flex items-center justify-between">
                  <span>Attention Needed</span>
                  <span className="text-amber-600 font-mono text-sm">&lt; {activePolicy.attention_threshold}%</span>
                </div>
                <div className="text-[11px] text-amber-600 mt-1">Subject assistance advised</div>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
                <div className="font-bold text-blue-800 flex items-center justify-between">
                  <span>Good Standing</span>
                  <span className="text-blue-600 font-mono text-sm">&ge; {activePolicy.good_standing_threshold}%</span>
                </div>
                <div className="text-[11px] text-blue-600 mt-1">Solid academic progress</div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <div className="font-bold text-emerald-800 flex items-center justify-between">
                  <span>Excellent</span>
                  <span className="text-emerald-600 font-mono text-sm">&ge; {activePolicy.excellent_threshold}%</span>
                </div>
                <div className="text-[11px] text-emerald-600 mt-1">High academic distinction</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-slate-500">
          No active grading policy currently found for this session.
        </div>
      )}

      {/* POLICY HISTORY TABLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Policy Versions &amp; Audit Trail</h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {policyHistory.length} Versions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Version &amp; Name</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Weights (T/Q/M/H)</th>
                <th className="px-4 py-3">Thresholds</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policyHistory.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{p.policy_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{p.version}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{p.scope}</td>
                  <td className="px-4 py-3 font-mono">
                    {Number(p.monthly_test_weight)}% / {Number(p.quiz_weight)}% / {Number(p.mid_term_weight)}% / {Number(p.homework_weight)}%
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    Crit &lt;{p.critical_risk_threshold}% · Attn &lt;{p.attention_threshold}%
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleActivate(p.id)}
                        disabled={actionLoading}
                        className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[11px] font-semibold flex items-center gap-1 ml-auto"
                      >
                        <Play className="w-3 h-3" /> Set Active
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE POLICY MODAL */}
      {createModal && (
        <Modal
          title="Configure Continuous Grading Policy"
          onClose={() => setCreateModal(false)}
        >
          <form onSubmit={handleCreatePolicy} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Policy Name</label>
              <input
                type="text"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="SESSION">Session Specific ({year.name})</option>
                  <option value="GLOBAL">Global Default</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Version Identifier</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. v1.1.0"
                  required
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Weights */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Formative Category Weights</label>
                <span className={`text-xs font-bold font-mono ${isWeightValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Sum: {totalWeights}% {isWeightValid ? '✓' : '(Must equal 100%)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Monthly Tests (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={monthlyWeight}
                    onChange={(e) => setMonthlyWeight(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Quizzes (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={quizWeight}
                    onChange={(e) => setQuizWeight(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Mid-Term Assessment (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={midTermWeight}
                    onChange={(e) => setMidTermWeight(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Homework &amp; Tasks (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={homeworkWeight}
                    onChange={(e) => setHomeworkWeight(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Thresholds */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Intervention Threshold Hierarchy (0-100)
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Critical Risk Threshold (&lt; %)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={critThreshold}
                    onChange={(e) => setCritThreshold(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Attention Needed (&lt; %)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={attnThreshold}
                    onChange={(e) => setAttnThreshold(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Good Standing (&ge; %)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={goodThreshold}
                    onChange={(e) => setGoodThreshold(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Excellent (&ge; %)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={exclThreshold}
                    onChange={(e) => setExclThreshold(Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !isWeightValid || !isThresholdValid}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                Save &amp; Activate Policy
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

