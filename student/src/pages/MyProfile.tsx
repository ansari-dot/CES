import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import { updatePreferences, toggleWhatsappAlerts, setToast, changePassword } from '../store/slices/studentSlice';

export default function MyProfile() {
  const dispatch = useDispatch<AppDispatch>();
  const profile = useSelector((state: RootState) => state.student.profile);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw) { setPwError("Please enter your current password."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match yet."); return; }
    setPwError("");
    setPwLoading(true);
    const result = await dispatch(changePassword({ currentPassword: currentPw, newPassword: newPw }));
    setPwLoading(false);
    if (changePassword.fulfilled.match(result)) {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      dispatch(setToast("Password updated successfully! Please log in again."));
    } else {
      setPwError(String(result.payload) || "Password change failed.");
    }
  };

  const handleTogglePref = (key: keyof typeof profile.alertPreferences) => {
    dispatch(updatePreferences({ [key]: !profile.alertPreferences[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Identity Card */}
      <div className="bg-card border border-border rounded-md p-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm">
        <img
          src={profile.avatar}
          alt={profile.name}
          className="w-20 h-20 rounded-full object-cover border-2 border-border"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4f46e5&color=fff`;
          }}
        />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h2 className="text-2xl font-headings font-bold text-foreground">{profile.name}</h2>
            <span className="bg-success-bg text-success text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Active
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {profile.grade} · Roll {profile.rollNumber} · Session {profile.session}
          </div>
        </div>

        {/* 3 Quick stats */}
        <div className="flex gap-6 text-center border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6">
          <div>
            <div className="text-xl font-bold font-headings text-foreground">94%</div>
            <div className="text-[11px] text-muted-foreground">Attendance</div>
          </div>
          <div>
            <div className="text-xl font-bold font-headings text-foreground">87%</div>
            <div className="text-[11px] text-muted-foreground">Average</div>
          </div>
          <div>
            <div className="text-xl font-bold font-headings text-foreground">{profile.stars}</div>
            <div className="text-[11px] text-muted-foreground">Stars</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact info & alerts */}
        <div className="bg-card border border-border rounded-md p-5 shadow-sm space-y-4">
          <div className="font-headings font-bold text-base text-foreground">Contact info</div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">GUARDIAN PHONE</label>
            <div className="flex items-center justify-between border border-border rounded-sm px-3 py-2 text-sm bg-muted/40">
              <span className="font-medium text-foreground">{profile.guardianPhone}</span>
              <span className="text-xs text-muted-foreground italic">School can edit</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">WHATSAPP ALERTS</label>
            <div className="flex items-center justify-between border border-border rounded-sm p-3 bg-card">
              <span className="text-xs font-medium text-foreground">On · class + fee reminders</span>
              <input
                type="checkbox"
                checked={profile.whatsappAlerts}
                onChange={() => dispatch(toggleWhatsappAlerts())}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="font-headings font-bold text-base text-foreground mb-4">Change password</div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Current password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="New password (8+ chars)"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-2 text-muted-foreground cursor-pointer"
              >
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {pwError && (
              <div className="text-[11px] text-error font-semibold">{pwError}</div>
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2 text-xs font-bold rounded-sm transition cursor-pointer disabled:opacity-60"
            >
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      {/* Alert Preferences */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="font-headings font-bold text-base text-foreground mb-4">Alert preferences</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between border border-border p-3 rounded-sm">
            <span className="text-xs font-medium text-foreground">Class reminders</span>
            <input
              type="checkbox"
              checked={profile.alertPreferences.classReminders}
              onChange={() => handleTogglePref('classReminders')}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between border border-border p-3 rounded-sm">
            <span className="text-xs font-medium text-foreground">Assignment due alerts</span>
            <input
              type="checkbox"
              checked={profile.alertPreferences.assignmentDue}
              onChange={() => handleTogglePref('assignmentDue')}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between border border-border p-3 rounded-sm">
            <span className="text-xs font-medium text-foreground">Result published</span>
            <input
              type="checkbox"
              checked={profile.alertPreferences.resultPublished}
              onChange={() => handleTogglePref('resultPublished')}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between border border-border p-3 rounded-sm">
            <span className="text-xs font-medium text-foreground">Fee reminders</span>
            <input
              type="checkbox"
              checked={profile.alertPreferences.feeReminders}
              onChange={() => handleTogglePref('feeReminders')}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
