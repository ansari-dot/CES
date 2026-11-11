import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { updateContactInfo, logoutTeacherThunk } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { requestApi } from '../services/api';
import {
  User,
  Shield,
  Lock,
  ShieldAlert,
  LogOut,
  Mail,
  Phone,
  KeyRound,
  GraduationCap,
  CheckCircle2,
  Settings,
  Calendar,
  Globe
} from 'lucide-react';

export const ProfileSettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);

  const [phone, setPhone] = useState(teacher.phone);
  const [email, setEmail] = useState(teacher.email);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(updateContactInfo({ phone, email }));
    dispatch(
      addToast({
        message: 'Teacher contact information updated successfully.',
        type: 'success',
      })
    );
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;
    if (newPassword.length < 10) {
      dispatch(addToast({ message: 'New password must be at least 10 characters long.', type: 'error' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      dispatch(addToast({ message: 'New password and confirmation do not match.', type: 'error' }));
      return;
    }
    try {
      setIsChangingPassword(true);
      await requestApi('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      dispatch(
        addToast({
          message: 'Password changed successfully. Please sign in again with your new password.',
          type: 'success',
        })
      );
      dispatch(logoutTeacherThunk());
    } catch (err: any) {
      dispatch(
        addToast({
          message: err?.message || 'Failed to change password. Please verify your current password.',
          type: 'error',
        })
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Settings className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Faculty Credentials &amp; Profile
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Identity &amp; Security
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Account Profile &amp; Settings
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Manage contact details, inspect assigned classes, and update security credentials.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. PROFILE GRID */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (5 cols): Profile Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80 space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <img
              src={teacher.avatar}
              alt={teacher.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-100 shadow-sm"
            />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{teacher.name}</h2>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#36348e] text-xs font-bold font-mono border border-indigo-100">
                {teacher.employeeId || 'FACULTY'}
              </span>
              <p className="text-xs text-slate-500 mt-1">{teacher.designation}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-200/70">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                Academic Term Allocation
              </span>
              <p className="font-extrabold text-slate-900 text-sm">{teacher.term}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-200/70">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                Timezone &amp; Locale
              </span>
              <p className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-700" />
                <span>{teacher.timezone} (Auto-synchronized)</span>
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Authorized Assigned Classes ({teacher.assignedClasses?.length || 0})
              </span>
              <div className="space-y-2">
                {teacher.assignedClasses?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No assigned classes found for this academic term.</p>
                ) : (
                  teacher.assignedClasses?.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{cls.name}</span>
                        <span className="text-[11px] text-slate-500">{cls.subject}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {cls.enrolledCount} Enrolled
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Contact Settings & Security */}
        <div className="lg:col-span-7 space-y-5">
          {/* Contact Details Form */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1e1b4b]">
                  Permitted Contact Information
                </h3>
                <p className="text-xs text-slate-500">Official email and telephone registered with campus administration</p>
              </div>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Institutional Email</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Direct Contact Phone</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer active:scale-[0.98]"
                >
                  Save Contact Updates
                </button>
              </div>
            </form>
          </div>

          {/* Password & Security */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1e1b4b]">Security &amp; Password</h3>
                <p className="text-xs text-slate-500">Update your account authentication credentials</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Current Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>New Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Confirm Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                >
                  {isChangingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Access Control Notice */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-600 flex items-start gap-3">
            <Lock className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block text-slate-900 font-bold">Institutional Access Control:</strong>
              Employment classification, salary structure, and official classroom assignments are
              configured by the Principal &amp; School Administrator. Protected personnel parameters cannot be changed by faculty directly.
            </div>
          </div>

          {/* Session Security & Logout */}
          <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Faculty Session Management
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                End your authenticated portal session. All protected routes will be locked immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await dispatch(logoutTeacherThunk());
                dispatch(
                  addToast({
                    title: 'Signed Out',
                    message: 'You have been securely signed out.',
                    type: 'info',
                  })
                );
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-[0.98]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Workstation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
