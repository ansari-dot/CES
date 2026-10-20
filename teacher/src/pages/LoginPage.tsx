import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loginTeacherThunk, setLoginError } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const loginError = useAppSelector((state) => state.auth.loginError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    dispatch(setLoginError(null));

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      dispatch(setLoginError('Please enter your institutional email or username.'));
      return;
    }

    if (!password.trim()) {
      dispatch(setLoginError('Please enter your portal password.'));
      return;
    }

    setIsSubmitting(true);

    try {
      const resultAction = await dispatch(
        loginTeacherThunk({
          identifier: cleanEmail,
          password,
          rememberMe,
        })
      );

      if (loginTeacherThunk.fulfilled.match(resultAction)) {
        dispatch(
          addToast({
            title: 'Welcome Back!',
            message: 'Signed in successfully to Online School Faculty Portal.',
            type: 'success',
          })
        );
      } else {
        const errorMsg =
          (resultAction.payload as string) ||
          'Authentication failed. Please verify your credentials.';
        dispatch(setLoginError(errorMsg));
      }
    } catch (err: any) {
      dispatch(setLoginError(err.message || 'Server error. Please try again later.'));
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitted(true);
    setTimeout(() => {
      setForgotSubmitted(false);
      setIsForgotModalOpen(false);
      dispatch(
        addToast({
          title: 'Reset Link Dispatched',
          message: `A secure password reset link was sent to ${forgotEmail}.`,
          type: 'info',
        })
      );
      setForgotEmail('');
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full bg-[#f1f5f9] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      {/* Clean, Professional Portal Container */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* Left Column: Clean Academic Imagery & Portal Info (No crazy neon/joker gradients) */}
        <div className="md:col-span-5 bg-slate-900 text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle clean image overlay */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <img
              src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1000&auto=format&fit=crop&q=80"
              alt="Classroom education"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3525cd] flex items-center justify-center text-white shadow-sm">
                <span className="material-symbols-outlined text-[22px]">school</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white font-heading">
                  EduPulse
                </h1>
                <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">
                  Faculty & Staff Portal
                </p>
              </div>
            </div>

            <div className="mt-8">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">verified</span>
                District 41 K-12 Portal
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-3 leading-snug font-heading">
                Academic Management & Instruction
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Access your real-time daily timetable, live Zoom classrooms, attendance records, and student grading.
              </p>
            </div>
          </div>

          {/* Middle: Feature Highlights */}
          <div className="relative z-10 my-6 space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
              <span>Daily timetable & room duty logs</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
              <span>1-click live Zoom classroom sessions</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
              <span>Instant assignment review & rubrics</span>
            </div>
          </div>

          {/* Bottom Security Info */}
          <div className="relative z-10 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-emerald-400">lock</span>
              256-Bit SSL Encrypted
            </span>
            <span>Academic Year 2024–2025</span>
          </div>
        </div>

        {/* Right Column: Clean, Modern Login Form (No "PORTAL ROLE" bar) */}
        <div className="md:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white">
          <div>
            {/* Header */}
            <div className="mb-6 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3525cd]">
                  Faculty Access
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  System Online
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
                Welcome back
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Please enter your credentials to access your account.
              </p>
            </div>

            {/* Error Message Banner */}
            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">
                    error
                  </span>
                  <span className="font-semibold">{loginError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(setLoginError(null))}
                  className="text-rose-500 hover:text-rose-800 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Login Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {/* Email / Username Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Institutional Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@edupulse.k12"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3525cd] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-xs font-medium text-[#3525cd] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3525cd] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#3525cd] focus:ring-[#3525cd]"
                  />
                  <span className="text-xs font-normal text-slate-600">
                    Remember me for 30 days
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#3525cd] hover:bg-[#281ca3] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>

          </div>

          {/* Footer Assistance */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-[#3525cd]">help</span>
              IT Helpdesk: <a href="mailto:support@edupulse.k12" className="text-[#3525cd] font-medium hover:underline">support@edupulse.k12</a>
            </span>
            <span>FERPA Certified & Secure</span>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative text-left">
            <button
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#3525cd] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[22px]">lock_reset</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 font-heading">
              Reset Password
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Enter your registered institutional email address. We will send a secure password reset link.
            </p>

            <form onSubmit={handleForgotSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@edupulse.k12"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3525cd]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitted}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#3525cd] hover:bg-[#281ca3] text-white flex items-center gap-1.5 disabled:opacity-75 cursor-pointer"
                >
                  {forgotSubmitted ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
