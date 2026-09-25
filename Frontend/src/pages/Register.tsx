import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.auth.register({ username, email, password });
      login(res);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)] px-4 relative overflow-hidden transition-colors">
      {/* Decorative Japanese character watermark */}
      <div className="absolute font-japanese -bottom-20 -left-20 text-[26rem] font-black text-zinc-200/50 dark:text-zinc-900/40 select-none pointer-events-none">
        学
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-rose-600 items-center justify-center shadow-xl shadow-cyan-950/60 mb-4">
            <span className="font-japanese text-3xl font-bold text-white">始</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Begin Your Journey</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
            Level 1 Radicals, Kanji, and Vocabulary are ready for you.
          </p>
        </div>

        <div className="glass-panel p-8 rounded-3xl shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 text-rose-800 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Learner Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kenji"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-red-600 dark:focus:border-rose-500 focus:ring-1 focus:ring-red-600 dark:focus:ring-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kenji@kotoba.app"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-red-600 dark:focus:border-rose-500 focus:ring-1 focus:ring-red-600 dark:focus:ring-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-red-600 dark:focus:border-rose-500 focus:ring-1 focus:ring-red-600 dark:focus:ring-rose-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-red-700 via-rose-600 to-teal-600 hover:from-red-600 hover:to-teal-500 text-white shadow-lg shadow-red-950/40 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Start</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-red-600 dark:text-rose-400 hover:underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
