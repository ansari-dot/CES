import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { updateContactInfo, logoutTeacherThunk } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';

export const ProfileSettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);

  const [phone, setPhone] = useState(teacher.phone);
  const [email, setEmail] = useState(teacher.email);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;
    dispatch(
      addToast({
        message: 'Security credentials updated. Password changed successfully.',
        type: 'success',
      })
    );
    setOldPassword('');
    setNewPassword('');
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-[#36348e] uppercase tracking-wider">
            Faculty Credentials
          </span>
          <span className="text-[#c7c4d8]">•</span>
          <span className="text-xs text-[#545454]">SRS Section 16</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight">
          Teacher Profile &amp; Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#545454] mt-0.5">
          Manage authorized contact details, inspect assigned class allocations, and manage secure session
          credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Profile Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <img
              src={teacher.avatar}
              alt={teacher.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-100 shadow-sm"
            />
            <div>
              <h2 className="text-lg font-bold text-[#292929]">{teacher.name}</h2>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-[#36348e] text-xs font-bold font-mono">
                {teacher.employeeId}
              </span>
              <p className="text-xs text-[#777587] mt-1">{teacher.designation}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#f1f1fa] rounded-xl space-y-1 border border-indigo-100/60">
              <span className="text-[#777587] font-semibold block">Academic Term Allocation:</span>
              <p className="font-bold text-[#292929]">{teacher.term}</p>
            </div>

            <div className="p-3 bg-[#f1f1fa] rounded-xl space-y-1 border border-indigo-100/60">
              <span className="text-[#777587] font-semibold block">Time Zone &amp; Locale:</span>
              <p className="font-bold text-[#292929]">{teacher.timezone} (Auto-synchronized)</p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-[#777587] uppercase tracking-wider block mb-2">
                Authorized Assigned Classes ({teacher.assignedClasses?.length || 0})
              </span>
              <div className="space-y-1.5">
                {teacher.assignedClasses?.length === 0 ? (
                  <p className="text-xs text-[#777587] py-2">No assigned classes found for this academic term.</p>
                ) : (
                  teacher.assignedClasses?.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-[#292929] block">{cls.name}</span>
                        <span className="text-[11px] text-[#777587]">{cls.subject}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#006c49]">
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
        <div className="lg:col-span-7 space-y-6">
          {/* Contact Details Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <span className="material-symbols-outlined text-[#36348e] text-[20px]">badge</span>
              <h3 className="text-base font-bold text-[#292929]">
                Permitted Contact Information
              </h3>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Institutional Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Direct Contact Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Save Contact Updates
                </button>
              </div>
            </form>
          </div>

          {/* Password & Security */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <span className="material-symbols-outlined text-[#36348e] text-[20px]">
                security
              </span>
              <h3 className="text-base font-bold text-[#292929]">Security &amp; Credentials</h3>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    New Security Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>

          {/* Access Control Notice */}
          <div className="p-4 rounded-2xl bg-[#f1f1fa] border border-indigo-100 text-xs text-[#545454] flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-[#36348e] shrink-0 mt-0.5">
              lock
            </span>
            <div className="leading-relaxed">
              <strong className="block text-[#292929]">SRS Section 16.3 Access Control:</strong>
              Employment classification, salary structure, and official classroom assignments are
              configured by the Principal &amp; School Administrator. Teachers cannot modify protected
              personnel parameters.
            </div>
          </div>

          {/* Session Security & Logout */}
          <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[19px] text-rose-600">security</span>
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
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
              Sign Out Workstation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
