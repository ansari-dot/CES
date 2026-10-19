import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Mail, Lock, Eye, EyeOff, Check, LogIn } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('principal@iqraonlineacademy.edu.pk');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info('Need help signing in? Contact your school administrator.');
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-[#eef2f7] font-sans text-[#1a2340] antialiased">
      {/* Left Column: Educational Technology Illustration */}
      <div className="flex-1 flex items-center justify-center py-12 px-6 lg:py-16 lg:px-12">
        <div className="w-full max-w-lg aspect-square flex items-center justify-center">
          <img
            src="https://storage.googleapis.com/banani-generated-images/generated-images/804be4f8-6a71-4b02-b9a1-dabe7a03f80a.jpg"
            alt="Students sitting at a table with laptops watching teacher presenting on large monitor screen"
            className="w-full max-w-lg aspect-square object-cover rounded-2xl shadow-sm"
          />
        </div>
      </div>

      {/* Right Column: Sign In Panel */}
      <div className="flex items-center justify-center lg:justify-start w-full lg:w-[620px] shrink-0 bg-[#eef2f7]">
        <div className="flex flex-col justify-center w-full max-w-xl px-6 sm:px-12 lg:px-16 py-12 lg:py-20">
          <h1 className="text-4xl font-heading font-bold text-[#1a2340] mb-2 tracking-tight">
            Welcome back
          </h1>
          <p className="text-lg text-[#5a6a8a] mb-10 font-sans">
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleSubmit} className="w-full">
            {/* Email or Username Field */}
            <div className="flex flex-col gap-2 w-full mb-6">
              <label className="text-sm font-sans font-semibold text-[#1a2340]">
                Email or Username
              </label>
              <div className="flex items-center gap-3 bg-white border border-[#d8e0ec] rounded-lg px-4 py-3 focus-within:border-[#3b3fc7] focus-within:ring-2 focus-within:ring-[#3b3fc7]/20 transition-all">
                <span className="inline-flex items-center justify-center shrink-0 w-[18px] h-[18px] text-[#6b7a99]">
                  <Mail className="w-[18px] h-[18px]" strokeWidth={2.4} />
                </span>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your email or username"
                  className="flex-1 text-base text-[#1a2340] placeholder:text-[#6b7a99] bg-transparent focus:outline-none font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2 w-full mb-5">
              <label className="text-sm font-sans font-semibold text-[#1a2340]">
                Password
              </label>
              <div className="flex items-center gap-3 bg-white border border-[#d8e0ec] rounded-lg px-4 py-3 focus-within:border-[#3b3fc7] focus-within:ring-2 focus-within:ring-[#3b3fc7]/20 transition-all">
                <span className="inline-flex items-center justify-center shrink-0 w-[18px] h-[18px] text-[#6b7a99]">
                  <Lock className="w-[18px] h-[18px]" strokeWidth={2.4} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your password"
                  className="flex-1 text-base text-[#1a2340] placeholder:text-[#6b7a99] bg-transparent focus:outline-none font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="inline-flex items-center justify-center shrink-0 w-[18px] h-[18px] text-[#6b7a99] hover:text-[#1a2340] transition-colors focus:outline-none cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <Eye className="w-[18px] h-[18px]" strokeWidth={2.4} />
                  ) : (
                    <EyeOff className="w-[18px] h-[18px]" strokeWidth={2.4} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between mb-6">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setRememberMe(!rememberMe)}
              >
                <div
                  className={`w-5 h-5 rounded-sm flex items-center justify-center transition-colors ${
                    rememberMe ? 'bg-[#3b3fc7]' : 'bg-white border border-[#d8e0ec]'
                  }`}
                >
                  {rememberMe && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
                  )}
                </div>
                <span className="text-sm font-sans text-[#1a2340]">
                  Remember me
                </span>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-sans text-[#3b3fc7] hover:underline font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full bg-[#3b3fc7] hover:bg-[#3236b3] active:bg-[#282b94] text-white text-base font-semibold rounded-lg py-4 mb-5 transition-all shadow-sm cursor-pointer disabled:opacity-70 font-sans"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" strokeWidth={2.4} />
              )}
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>

            {/* Error Banner matching user design */}
            {error && (
              <div className="flex items-center gap-3 bg-[#fff0f0] border border-[#e53935] rounded-lg px-4 py-3 mb-8 animate-in fade-in">
                <div className="w-5 h-5 rounded-full bg-[#e53935] flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold leading-none">!</span>
                </div>
                <span className="text-sm font-sans text-[#e53935]">
                  {error}
                </span>
              </div>
            )}

            {/* Hairline Divider */}
            <div className="border-t border-[#d8e0ec] mb-6"></div>

            {/* Help text footer */}
            <p className="text-sm font-sans text-[#6b7a99] text-center">
              Need help signing in? Contact your school administrator.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
