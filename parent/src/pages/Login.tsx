import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Users } from 'lucide-react';
import { useParent } from '../context/ParentContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, authLoading, user } = useParent();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/parent/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError(null);
    try {
      await login(identifier.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-white border border-border flex items-center justify-center mb-3 overflow-hidden shadow-sm">
            <img src="/logo.jpeg" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-headings font-bold text-2xl text-foreground">Cambridge Education System</h1>
          <p className="text-sm text-muted-foreground mt-1">Parent Portal</p>
        </div>

        <div className="bg-card border border-border rounded-md p-6 shadow-sm">
          <h2 className="font-headings font-bold text-lg text-foreground mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Email, Username or Phone</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. parent@example.com"
                required
                autoComplete="username"
                className="w-full bg-card border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-card border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-2.5 text-muted-foreground cursor-pointer"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-error font-semibold bg-error/10 border border-error/20 rounded-sm px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 text-sm font-bold rounded-sm transition disabled:opacity-60 cursor-pointer"
            >
              {authLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Use the credentials issued by the school office for your parent account.
          </p>
        </div>
      </div>
    </div>
  );
}
