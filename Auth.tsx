/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, ShieldAlert, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AuthProps {
  onSuccess: (user: any) => void;
  onClose?: () => void;
  initialMode?: 'login' | 'register';
}

export default function Auth({ onSuccess, onClose, initialMode = 'login' }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login' ? { email, password } : { email, username, password };
      
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }

      localStorage.setItem('dark_watch_token', data.token);
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed, please check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8" dir="ltr">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative overflow-hidden"
      >
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            className="inline-block text-3xl font-extrabold tracking-wider mb-2 font-mono"
          >
            <span className="text-red-600 font-black">DARK</span>
            <span className="text-white ml-1 font-light">WATCH</span>
          </motion.div>
          <p className="text-neutral-400 text-sm mt-2">
            {mode === 'login' 
              ? 'Welcome back! Sign in to continue reading your favorite series' 
              : 'Create an account to save bookmarks, post comments, and track reading history'}
          </p>
        </div>

        {/* Error notification */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-950/40 border border-red-900/60 rounded-xl flex items-start gap-3 text-red-200 text-xs text-left"
            >
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" dir="ltr">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-2">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 w-5 h-5 text-neutral-500" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ShadowReader"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-white pl-10 pr-3 py-2.5 rounded-xl text-sm transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-white pl-10 pr-3 py-2.5 rounded-xl text-sm transition-all text-left"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-500" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-white pl-10 pr-10 py-2.5 rounded-xl text-sm transition-all text-left"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-neutral-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div className="flex items-center justify-between text-[11px] font-sans">
              <label className="flex items-center gap-2 text-neutral-400 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-neutral-800 bg-neutral-950 text-red-600 focus:ring-red-600 focus:ring-opacity-25 w-3.5 h-3.5"
                />
                <span>Remember me</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-red-950/25 transition-all text-sm mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="border-2 border-white/20 border-t-white w-4 h-4 rounded-full animate-spin"></span>
            ) : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center mt-6">
          <button 
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium cursor-pointer"
          >
            {mode === 'login' 
              ? "Don't have an account? Register now" 
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
