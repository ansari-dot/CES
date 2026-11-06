import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loginTeacherThunk, setLoginError } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import {
  BookOpen,
  Users,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  HelpCircle,
  AlertCircle,
  X,
  Sparkles
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const loginError = useAppSelector((state) => state.auth.loginError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
            message: 'Signed in successfully to Cambridge Education System.',
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
    <div
      className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-cover bg-center bg-no-repeat font-sans"
      style={{ backgroundImage: `url('/loginbc.webp')` }}
    >
      {/* Subtle soft backdrop gradient to guarantee perfect contrast */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[0.5px] pointer-events-none" />

      {/* Main Two-Column Container matching exact layout */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: School Logo, Heading, Subtitle & 3 Value Props */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-left pl-2 sm:pl-4">
          {/* Institutional Badge with Cambridge Logo */}
          <div className="inline-flex items-center gap-3 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-sm border border-slate-200/80 w-fit">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center">
              <img
                src="/logowb.png"
                alt="Cambridge Education System Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-tight text-[#1b1a47] uppercase leading-none">
                Cambridge Education System
              </span>
              <span className="text-[10px] font-bold text-[#c8952b] tracking-wider uppercase mt-0.5">
                Excellence in Digital Learning
              </span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-serif font-bold tracking-tight text-[#1b1a47] leading-[1.12]">
            Empowering Educators, <br />
            <span className="text-[#c8952b]">Inspiring Futures</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-700 font-medium max-w-md leading-relaxed">
            A world-class learning environment for educators and staff.
          </p>

          {/* 3 Badges: Learn Grow, Collaborate Succeed, Achieve More */}
          <div className="flex items-center gap-6 sm:gap-10 pt-2">
            {/* 1. Learn Grow */}
            <div className="flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-2xl bg-[#eef0fc] text-[#36348e] flex items-center justify-center shadow-xs mb-2 border border-indigo-100/60">
                <BookOpen className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">Learn</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">Grow</span>
            </div>

            {/* 2. Collaborate Succeed */}
            <div className="flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-2xl bg-[#fff7e5] text-[#b47e17] flex items-center justify-center shadow-xs mb-2 border border-amber-200/60">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">Collaborate</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">Succeed</span>
            </div>

            {/* 3. Achieve More */}
            <div className="flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-2xl bg-[#eef0fc] text-[#36348e] flex items-center justify-center shadow-xs mb-2 border border-indigo-100/60">
                <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-slate-800 leading-tight">Achieve</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">More</span>
            </div>
          </div>
        </div>

        {/* Right Column: Floating White Login Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-[430px] bg-white rounded-3xl sm:rounded-[32px] p-7 sm:p-9 shadow-2xl border border-white/80 flex flex-col justify-between">
            <div>
              {/* Card Header with Logo + Brand Tag */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  <img
                    src="/logowb.png"
                    alt="Cambridge Education System Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#c8952b] block leading-none">
                    FACULTY &amp; STAFF PORTAL
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Cambridge Education System
                  </span>
                </div>
              </div>

              {/* Decorative Gold Underline */}
              <div className="w-12 h-0.5 bg-[#c8952b] mb-4 rounded-full" />

              {/* Card Title */}
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1a47] tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-6">
                Please sign in to continue to your faculty workspace.
              </p>

              {/* Login Error Notification */}
              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Field 1: Email or Username */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#1b1a47] mb-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#36348e]" />
                    <span>Email or Username</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email or username"
                      required
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-[#36348e] focus:ring-1 focus:ring-[#36348e] transition-all"
                    />
                  </div>
                </div>

                {/* Field 2: Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#1b1a47]">
                      <Lock className="w-3.5 h-3.5 text-[#36348e]" />
                      <span>Password</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(true)}
                      className="text-xs font-medium text-[#36348e] hover:text-[#1b1a47] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-[#36348e] focus:ring-1 focus:ring-[#36348e] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Field 3: Remember Me */}
                <div className="pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#36348e] focus:ring-[#36348e] cursor-pointer"
                    />
                    <span className="text-xs text-slate-600 font-medium">Remember me for 30 days</span>
                  </label>
                </div>

                {/* Submit Button (Brand Navy with Gold Glow) */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3.5 px-5 rounded-xl bg-[#1b1a47] hover:bg-[#36348e] active:bg-[#121135] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Card Footer */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Need help?{' '}
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[#36348e] font-bold hover:underline"
                  >
                    Contact IT Support
                  </button>
                </span>
              </div>
              <div className="h-3.5 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#36348e]" />
                <span>Secure Access</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password / IT Support Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1b1a47]">Faculty IT Support</h3>
                  <p className="text-xs text-slate-500">Password recovery &amp; workstation access</p>
                </div>
              </div>
              <button
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your registered faculty email address. If an active faculty record exists, an instant password reset link will be dispatched.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. sarah.jenkins@school.pk"
                  required
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#36348e] focus:ring-1 focus:ring-[#36348e] font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitted}
                  className="px-5 py-2 bg-[#1b1a47] hover:bg-[#36348e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {forgotSubmitted ? 'Sending Link...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
