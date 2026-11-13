import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TimezonePreferenceCard } from '../../components/common/TimezonePreferenceCard';
import {
  ShieldAlert,
  User,
  Mail,
  Phone,
  Lock,
  Server,
  KeyRound,
  Database,
  CheckCircle2,
  AlertTriangle,
  LogOut
} from 'lucide-react';

export const ProfileModule: React.FC = () => {
  const { currentUser, updateProfile, logout } = useAuth();
  const [phone, setPhone] = useState(currentUser?.phone || '+92 300 8472910');
  const [email, setEmail] = useState(currentUser?.email || 'principal@iqraonlineacademy.edu.pk');
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const toast = useToast();

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({ phone, email });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.warning('Password must be at least 8 characters.');
      return;
    }
    toast.success('Principal account security credentials updated.');
    setPasswordModalOpen(false);
    setNewPassword('');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Principal Profile & System Boundaries</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational credentials for Dr. Tariq Mahmood, active permissions, and Administrator technical boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            Principal Role Verified
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card & Contact Edit */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 font-bold text-lg flex items-center justify-center border border-amber-200 shadow-2xs">
                TM
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{currentUser?.name || 'Dr. Tariq Mahmood'}</h3>
                <p className="text-xs text-slate-500">{currentUser?.designation || 'Principal'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={currentUser?.accountStatus || 'Active'} />
                  <span className="text-[11px] text-slate-400 font-mono">
                    Member since {currentUser?.joiningDate || '2022-01-15'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateContact} className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Direct Phone</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
                  <span>Change Password</span>
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors shadow-xs"
                >
                  {saving ? 'Saving...' : 'Update Contact Info'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Protected Administrator Boundaries (SRS 21.3 & 23) */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" strokeWidth={1.75} />
              <span>Protected Administrator Controls</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              In accordance with SRS Section 21.3, technical configurations reserved for the <strong>Administrator</strong> are restricted from the Principal Portal:
            </p>

            <ul className="space-y-2.5 text-[11px] text-slate-700">
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>Zoom OAuth API Secret Keys & Webhook endpoints</span>
              </li>
              <li className="flex items-start gap-2">
                <Database className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>Production database migrations & raw backup snapshots</span>
              </li>
              <li className="flex items-start gap-2">
                <Server className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>Server network rules, port bindings, and TLS certificates</span>
              </li>
            </ul>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 leading-relaxed">
              Any changes to system-level infrastructure require delegation from Central IT Administration.
            </div>
          </div>

          {/* Display timezone preference */}
          <TimezonePreferenceCard />

          {/* Active Security Session Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 font-heading">Security Session</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              You are currently authenticated as <strong>{currentUser?.name || 'Dr. Tariq Mahmood'}</strong>. Logging out will immediately lock the portal and require password verification.
            </p>
            <button
              type="button"
              onClick={logout}
              className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Sign Out from this Device</span>
            </button>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Change Portal Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1">New Secure Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
                >
                  Confirm Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
