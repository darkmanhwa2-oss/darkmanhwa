/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, BookMarked, History, Bell, Settings2, ShieldCheck, 
  Trash2, Mail, KeyRound, Image as ImageIcon, ArrowRightLeft, Sparkles, BookOpen,
  Flame, Award, Layers, RefreshCw
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { User, Series } from '../types';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate: (page: string, params?: any) => void;
  onUpdateUser: (newUser: User) => void;
  initialTab?: string;
  onRefreshUnreadCount?: () => void;
}

interface HistoryItem {
  userId: string;
  seriesId: string;
  chapterId: string;
  chapterNumber: number;
  pageNum: number;
  updatedAt: string;
  seriesTitleAr: string;
  seriesTitleEn: string;
  coverUrl: string;
  chapterTitleAr: string;
}

export default function Profile({ currentUser, onLogout, onNavigate, onUpdateUser, initialTab, onRefreshUnreadCount }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'notifications' | 'settings' | 'vip'>(() => {
    if (initialTab === 'notifications' || initialTab === 'history' || initialTab === 'settings' || initialTab === 'favorites' || initialTab === 'vip') {
      return initialTab as any;
    }
    return 'favorites';
  });
  const [favorites, setFavorites] = useState<Series[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Advanced My List states
  const [readingStatuses, setReadingStatuses] = useState<any[]>([]);
  const [aniListUsername, setAniListUsername] = useState(currentUser.aniListUsername || '');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState('');
  const [selectedListFilter, setSelectedListFilter] = useState<'all' | 'reading' | 'plan_to_read' | 'completed' | 'on_hold' | 'dropped'>('all');
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' ? (window.Notification ? window.Notification.permission : 'denied') : 'default'
  );

  useEffect(() => {
    if (initialTab === 'notifications' || initialTab === 'favorites' || initialTab === 'history' || initialTab === 'settings' || initialTab === 'vip') {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  // Editing profile states
  const [username, setUsername] = useState(currentUser.username);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-configured elegant avatar links
  const defaultAvatars = [
    'https://c.top4top.io/p_38444apdb1.jpg',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80',
  ];

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

  const fetchReadingStatuses = async () => {
    try {
      const res = await apiFetch('/api/users/reading-status');
      setReadingStatuses(res);
    } catch (err) {
      console.error('Error fetching reading statuses:', err);
    }
  };

  const fetchTabData = async () => {
    try {
      if (activeTab === 'favorites') {
        const res = await apiFetch('/api/favorites');
        setFavorites(res);
        await fetchReadingStatuses();
      } else if (activeTab === 'history') {
        const res = await apiFetch('/api/reading-history');
        setHistory(res);
      } else if (activeTab === 'notifications') {
        const res = await apiFetch('/api/notifications');
        setNotifications(res);
        if (onRefreshUnreadCount) {
          onRefreshUnreadCount();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncAniList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncLoading(true);
    setSyncSuccess('');
    try {
      const res = await apiFetch('/api/users/sync-anilist', {
        method: 'POST',
        body: JSON.stringify({ username: aniListUsername })
      });
      setSyncSuccess(res.message);
      onUpdateUser({ ...currentUser, aniListUsername });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error syncing with AniList');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !window.Notification) {
      alert('Your browser does not support notifications.');
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new window.Notification('Notifications enabled! 🔔', {
          body: 'You will receive notifications when new chapters are released.',
          icon: currentUser.avatarUrl
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      fetchTabData();
      if (onRefreshUnreadCount) {
        onRefreshUnreadCount();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.read) {
        await apiFetch(`/api/notifications/${notif.id}/read`, { method: 'POST' });
      }
      if (onRefreshUnreadCount) {
        onRefreshUnreadCount();
      }
      if (notif.chapterId) {
        onNavigate('reader', { id: notif.chapterId });
      } else if (notif.seriesId) {
        onNavigate('details', { id: notif.seriesId });
      } else {
        fetchTabData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/update', {
        method: 'PUT',
        body: JSON.stringify({
          username,
          avatarUrl,
          ...(newPassword ? { password, newPassword } : {})
        })
      });

      onUpdateUser(res.user);
      setSuccessMsg(res.message || 'Profile updated successfully!');
      setPassword('');
      setNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-16 text-left" dir="ltr">
      {/* 1. TOP PROFILE HEADER BANNER */}
      <div className="bg-gradient-to-r from-crimson-950/25 via-obsidian-900/80 to-obsidian-950 p-6 md:p-10 rounded-3xl border border-obsidian-850 flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-crimson-600/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Avatar wrap */}
        <div className="relative group shrink-0">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.username}
            referrerPolicy="no-referrer"
            className="w-24 h-24 md:w-32 md:h-32 rounded-3xl object-cover border-2 border-crimson-600 shadow-lg"
          />
          {currentUser.role === 'admin' && (
            <div className="absolute -bottom-2 -right-2 bg-crimson-600 text-white font-black text-[9px] font-sans px-2.5 py-1 rounded-lg border border-black shadow flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" /> Admin
            </div>
          )}
        </div>

        {/* Name and Quick Meta */}
        <div className="text-center md:text-left space-y-3 flex-1">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
            <h1 className="text-xl md:text-3xl font-black text-white">{currentUser.username}</h1>
            
            {/* Level and Streak Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="bg-crimson-950 border border-crimson-900/40 text-crimson-400 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Level {currentUser.level || 1}
              </span>
              <span className="bg-amber-950 border border-amber-900/40 text-amber-500 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1" title="Daily Reading Streak">
                <Flame className="w-3.5 h-3.5 fill-current text-amber-500" /> {currentUser.streak || 1} Day Streak
              </span>
            </div>
          </div>

          <p className="text-neutral-500 text-xs md:text-sm font-sans flex items-center justify-center md:justify-start gap-1">
            <Mail className="w-4 h-4 text-crimson-500" /> {currentUser.email}
          </p>

          {/* Gamification Progress Bar */}
          <div className="space-y-1 max-w-sm mx-auto md:mx-0">
            <div className="flex justify-between text-[10px] font-bold text-neutral-400">
              <span>Reading XP:</span>
              <span className="font-mono text-neutral-200">{(currentUser.xp || 0) % 100} / 100</span>
            </div>
            <div className="w-full h-2 bg-obsidian-950 border border-obsidian-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-crimson-600 to-rose-400 rounded-full transition-all duration-500"
                style={{ width: `${(currentUser.xp || 0) % 100}%` }}
              ></div>
            </div>
          </div>

          {/* Badges and achievements list */}
          {currentUser.badges && currentUser.badges.length > 0 && (
            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1">
              {currentUser.badges.map((badge, bIdx) => (
                <span 
                  key={bIdx} 
                  className="bg-obsidian-900 border border-obsidian-800 text-neutral-300 text-[9px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm"
                >
                  <Award className="w-3 h-3 text-amber-500" /> {badge}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-center md:justify-start gap-3 text-[11px] pt-1">
            <span className="bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-xl text-neutral-400">
              Role: <strong className="text-crimson-500 capitalize">{currentUser.role}</strong>
            </span>
            <span className="bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-xl text-neutral-400">
              Joined: <strong className="text-white font-sans">{new Date(currentUser.createdAt).toLocaleDateString('en-US')}</strong>
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="bg-obsidian-950 hover:bg-crimson-950/20 border border-obsidian-800 hover:border-crimson-900/40 text-neutral-400 hover:text-crimson-500 px-6 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer self-center shrink-0"
        >
          Sign Out
        </button>
      </div>

      {/* 2. TAB CONTROLS NAVIGATION */}
      <div className="flex border-b border-obsidian-800 gap-4 overflow-x-auto pb-1 font-sans">
        {[
          { id: 'favorites', name: 'My Bookmarks', icon: BookMarked },
          { id: 'history', name: 'Reading History', icon: History },
          { id: 'notifications', name: 'Notifications', icon: Bell },
          { id: 'settings', name: 'Account Settings', icon: Settings2 },
          { id: 'vip', name: 'VIP Membership (Ad-Free)', icon: Sparkles },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer shrink-0 ${activeTab === tab.id ? 'border-crimson-600 text-crimson-500' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              <Icon className="w-4.5 h-4.5" /> {tab.name}
            </button>
          );
        })}
      </div>

      {/* 3. DYNAMIC TAB CONTENT BODY */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {/* TAB: FAVORITES */}
            {activeTab === 'favorites' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <h2 className="text-xl font-black text-white">My Library & Favorites</h2>
                  
                  {/* Categorized Filter Pills */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                    {[
                      { id: 'all', name: 'All' },
                      { id: 'reading', name: 'Reading' },
                      { id: 'plan_to_read', name: 'Plan to Read' },
                      { id: 'completed', name: 'Completed' },
                      { id: 'on_hold', name: 'On Hold' },
                      { id: 'dropped', name: 'Dropped' }
                    ].map(pill => (
                      <button
                        key={pill.id}
                        onClick={() => setSelectedListFilter(pill.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedListFilter === pill.id
                            ? 'bg-crimson-600 text-white shadow-md'
                            : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-850 hover:text-white'
                        }`}
                      >
                        {pill.name}
                      </button>
                    ))}
                  </div>
                </div>

                {favorites.filter(s => {
                  if (selectedListFilter === 'all') return true;
                  const statusObj = readingStatuses.find(stat => stat.seriesId === s.id);
                  return statusObj && statusObj.status === selectedListFilter;
                }).length === 0 ? (
                  <div className="bg-obsidian-950 border border-obsidian-850 p-12 text-center rounded-2xl text-neutral-500 text-sm">
                    {selectedListFilter === 'all' 
                      ? 'No bookmarks added yet. Browse and bookmark your favorite series!'
                      : 'No series in this list currently.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {favorites
                      .filter(s => {
                        if (selectedListFilter === 'all') return true;
                        const statusObj = readingStatuses.find(stat => stat.seriesId === s.id);
                        return statusObj && statusObj.status === selectedListFilter;
                      })
                      .map(s => {
                        const statusObj = readingStatuses.find(stat => stat.seriesId === s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => onNavigate('details', { id: s.id })}
                            className="group relative cursor-pointer"
                          >
                            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-obsidian-800 group-hover:border-crimson-600 transition-all shadow-md">
                              <img src={s.coverUrl} alt={s.titleAr || s.titleEn} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              {statusObj && (
                                <span className={`absolute top-2 left-2 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border text-white capitalize ${
                                  statusObj.status === 'reading' ? 'bg-emerald-600 border-emerald-500/30' :
                                  statusObj.status === 'plan_to_read' ? 'bg-indigo-600 border-indigo-500/30' :
                                  statusObj.status === 'completed' ? 'bg-crimson-600 border-crimson-500/30' :
                                  statusObj.status === 'on_hold' ? 'bg-amber-600 border-amber-500/30' :
                                  'bg-neutral-600 border-neutral-500/30'
                                }`}>
                                  {statusObj.status.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-xs text-neutral-300 group-hover:text-crimson-500 truncate mt-2">{s.titleAr || s.titleEn}</h3>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: READING HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-white">Recent Reading History</h2>
                {history.length === 0 ? (
                  <div className="bg-obsidian-950 border border-obsidian-850 p-12 text-center rounded-2xl text-neutral-500 text-sm">
                    No reading history yet. Once you open a chapter, your reading progress will be saved automatically!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {history.map((h, idx) => (
                      <div
                        key={idx}
                        onClick={() => onNavigate('reader', { id: h.chapterId })}
                        className="bg-obsidian-950 hover:bg-obsidian-900/60 border border-obsidian-800 p-4 rounded-2xl flex gap-4 items-center cursor-pointer transition-all"
                      >
                        <img src={h.coverUrl} alt={h.seriesTitleEn || h.seriesTitleAr} referrerPolicy="no-referrer" className="w-14 h-20 object-cover rounded-xl border border-obsidian-800 shrink-0" />
                        <div className="space-y-1 overflow-hidden">
                          <h3 className="font-bold text-sm text-white truncate">{h.seriesTitleEn || h.seriesTitleAr}</h3>
                          <p className="text-xs text-crimson-500 font-bold">Chapter {h.chapterNumber}</p>
                          <p className="text-[10px] text-neutral-500">
                            Page: <strong className="text-neutral-300 font-mono">{h.pageNum}</strong>
                          </p>
                          <p className="text-[9px] text-neutral-600 font-sans">Last read: {new Date(h.updatedAt).toLocaleString('en-US')}</p>
                        </div>
                        <button className="ml-auto bg-obsidian-900 border border-obsidian-800 p-2 rounded-xl text-neutral-400 hover:text-white transition-colors">
                          <BookOpen className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                {notificationPermission !== 'granted' && (
                  <div className="bg-gradient-to-r from-indigo-950/40 via-obsidian-900/60 to-obsidian-950 border border-indigo-900/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <h4 className="text-xs font-black text-white flex items-center justify-center sm:justify-start gap-1">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        Enable Web Push Notifications
                      </h4>
                      <p className="text-[10px] text-neutral-400">Get instant alerts on your device when new chapters are released for your favorite series.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestNotificationPermission}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md"
                    >
                      Enable Notifications
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-obsidian-850 pb-4">
                  <h2 className="text-xl font-black text-white">Notification Inbox</h2>
                  {notifications.some(n => !n.read) && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-black text-crimson-500 hover:text-crimson-400 bg-crimson-950/30 hover:bg-crimson-950/50 border border-crimson-900/40 py-2 px-4 rounded-xl transition-all cursor-pointer"
                    >
                      Mark All as Read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="bg-obsidian-950 border border-obsidian-850 p-12 text-center rounded-2xl text-neutral-500 text-sm">
                    No new notifications. We'll notify you as soon as new chapters come out!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-4 rounded-2xl border transition-all text-left space-y-2 relative overflow-hidden cursor-pointer hover:scale-[1.01] ${
                          n.read 
                            ? 'bg-obsidian-950/40 border-obsidian-900/60 text-neutral-400 hover:bg-obsidian-900/20' 
                            : 'bg-gradient-to-r from-crimson-950/20 via-obsidian-950 to-obsidian-950 border-crimson-900/30 text-white hover:border-crimson-600/40'
                        }`}
                      >
                        {!n.read && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-crimson-500 rounded-full animate-pulse ring-4 ring-crimson-900/50"></div>
                        )}
                        <div className="flex items-center gap-2">
                          <Sparkles className={`w-4 h-4 shrink-0 ${n.read ? 'text-neutral-500' : 'text-crimson-500'}`} />
                          <h3 className={`font-black text-xs md:text-sm ${n.read ? 'text-neutral-300' : 'text-white'}`}>
                            {n.title}
                          </h3>
                        </div>
                        <p className={`text-xs leading-relaxed ${n.read ? 'text-neutral-500' : 'text-neutral-300'}`}>
                          {n.content}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-obsidian-900/40 text-[9px] text-neutral-600 font-sans">
                          <span>{new Date(n.addedAt).toLocaleString('en-US')}</span>
                          {!n.read && (
                            <span className="text-crimson-400 font-bold bg-crimson-950/60 border border-crimson-900/20 px-2 py-0.5 rounded-full text-[9px] font-sans">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SETTINGS & EDIT */}
            {activeTab === 'settings' && (
              <div className="max-w-2xl bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-black text-white">Account Settings & Security</h2>
                
                {successMsg && <div className="p-4 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-xs text-emerald-400">{successMsg}</div>}
                {errorMsg && <div className="p-4 bg-crimson-950/30 border border-crimson-900/60 rounded-xl text-xs text-crimson-400">{errorMsg}</div>}

                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 font-sans">Username:</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 w-5 h-5 text-neutral-500" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-obsidian-900 border border-obsidian-800 focus:border-crimson-600 text-white pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      />
                    </div>
                  </div>

                  {/* Avatar Select */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-neutral-400 font-sans">Choose Avatar:</label>
                    <div className="grid grid-cols-6 gap-3">
                      {defaultAvatars.map((url, index) => (
                        <button
                          type="button"
                          key={index}
                          onClick={() => setAvatarUrl(url)}
                          className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${avatarUrl === url ? 'border-crimson-600 scale-105' : 'border-transparent hover:border-obsidian-700'}`}
                        >
                          <img src={url} alt={`avatar-${index}`} referrerPolicy="no-referrer" className="w-full aspect-square object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Password reset toggles */}
                  <div className="pt-4 border-t border-obsidian-850 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-crimson-500" /> Change Password (Optional)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] text-neutral-500 mb-1.5 font-sans">Current Password:</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-500 mb-1.5 font-sans">New Password:</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs mt-4 flex items-center justify-center gap-2 font-sans"
                  >
                    {loading ? (
                      <span className="border-2 border-white/20 border-t-white w-4 h-4 rounded-full animate-spin"></span>
                    ) : 'Save Changes'}
                  </button>
                </form>

                {/* AniList Sync Panel */}
                <div className="pt-6 border-t border-obsidian-850 space-y-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-500" />
                    <div>
                      <h3 className="text-sm font-black text-white">AniList Sync</h3>
                      <p className="text-[10px] text-neutral-500">Sync your reading progress automatically with your AniList account.</p>
                    </div>
                  </div>

                  {syncSuccess && (
                    <div className="p-3.5 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-xs text-indigo-400">
                      {syncSuccess}
                    </div>
                  )}

                  <form onSubmit={handleSyncAniList} className="flex gap-3">
                    <input
                      type="text"
                      value={aniListUsername}
                      onChange={(e) => setAniListUsername(e.target.value)}
                      placeholder="AniList Username"
                      className="flex-1 bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none focus:border-indigo-600 font-sans"
                      required
                    />
                    <button
                      type="submit"
                      disabled={syncLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {syncLoading ? (
                        <span className="border-2 border-white/20 border-t-white w-3 h-3 rounded-full animate-spin"></span>
                      ) : 'Connect & Sync'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB: VIP & ADS */}
            {activeTab === 'vip' && (
              <div className="max-w-3xl space-y-6 text-left">
                <div className="bg-gradient-to-r from-obsidian-950 via-crimson-950/20 to-obsidian-950 border border-crimson-900/30 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-crimson-600/10 rounded-full blur-3xl -z-10"></div>
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-600/10 rounded-full blur-3xl -z-10"></div>

                  <div className="flex flex-col md:flex-row items-center gap-6 justify-between border-b border-obsidian-800 pb-6">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <Sparkles className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
                        <h2 className="text-xl font-black text-white">VIP Membership - Ad-Free Experience</h2>
                      </div>
                      <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                        انضم لعضوية VIP الفاخرة في دارك مانهوا (Dark Manhwa)! تمنحك العضوية الشارة الذهبية وتخفي جميع الإعلانات بالكامل لتستمتع بقراءة متواصلة وسريعة بدقة عالية.
                      </p>
                    </div>

                    <div className="shrink-0">
                      {currentUser.badges?.includes('VIP') ? (
                        <div className="bg-amber-950/50 border border-amber-500/40 px-5 py-3 rounded-2xl text-center space-y-1">
                          <Award className="w-8 h-8 text-amber-500 mx-auto animate-bounce" />
                          <span className="text-xs font-black text-amber-400 block font-sans">Active VIP Member!</span>
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const res = await apiFetch('/api/users/claim-vip', { method: 'POST' });
                              if (res.success) {
                                onUpdateUser(res.user);
                                alert('🎉 تهانينا! حصلت على العضوية الذهبية VIP وقراءة خالية تماماً من الإعلانات!');
                              }
                            } catch (err: any) {
                              alert(err.message || 'Failed to claim VIP');
                            }
                          }}
                          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold px-6 py-3.5 rounded-2xl text-xs tracking-wide transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 font-sans"
                        >
                          <Sparkles className="w-4 h-4 text-black" /> Claim Free VIP Membership
                        </button>
                      )}
                    </div>
                  </div>

                  {/* VIP Perks */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="bg-obsidian-900/60 border border-obsidian-850 p-4 rounded-2xl space-y-2">
                      <div className="w-8 h-8 rounded-full bg-crimson-950/40 text-crimson-500 flex items-center justify-center font-bold">
                        1
                      </div>
                      <h4 className="text-xs font-black text-neutral-200">100% Ad-Free Reading</h4>
                      <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">Instantly disable popunder, interstitials, social bars, and banner ads.</p>
                    </div>

                    <div className="bg-obsidian-900/60 border border-obsidian-850 p-4 rounded-2xl space-y-2">
                      <div className="w-8 h-8 rounded-full bg-amber-950/40 text-amber-500 flex items-center justify-center font-bold">
                        2
                      </div>
                      <h4 className="text-xs font-black text-neutral-200">Special VIP Badge</h4>
                      <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">Display a glowing VIP badge on your profile and next to your comments.</p>
                    </div>

                    <div className="bg-obsidian-900/60 border border-obsidian-850 p-4 rounded-2xl space-y-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-950/40 text-indigo-500 flex items-center justify-center font-bold">
                        3
                      </div>
                      <h4 className="text-xs font-black text-neutral-200">High-Speed Image CDN</h4>
                      <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">Priority image bandwidth for fast loading of manga pages.</p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
