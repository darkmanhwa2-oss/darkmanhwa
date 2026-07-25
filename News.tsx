/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Newspaper, Plus, Trash2, Calendar, Eye, User as UserIcon, X, Sparkles, BookOpen } from 'lucide-react';
import { NewsArticle, User } from '../types';
import { apiFetch } from '../lib/api';

interface NewsProps {
  currentUser: User | null;
  onNavigate: (page: string, params?: any) => void;
}

export default function News({ currentUser, onNavigate }: NewsProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected article to read in modal
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // Publish Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/news');
      setArticles(res);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError('Unable to load news articles at the moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      setError('Title and content are required.');
      return;
    }

    setFormSubmitting(true);
    setError('');
    setFormSuccess('');

    try {
      const token = localStorage.getItem('dark_watch_token');
      const res = await apiFetch('/api/news', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          content,
          imageUrl
        })
      });

      if (res.success) {
        setFormSuccess(res.message);
        setTitle('');
        setContent('');
        setImageUrl('');
        setShowAddForm(false);
        fetchArticles();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to publish article');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteArticle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this article?')) return;

    try {
      const token = localStorage.getItem('dark_watch_token');
      const res = await apiFetch(`/api/news/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.success) {
        fetchArticles();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete article');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');

  return (
    <div className="space-y-8 pb-16 text-left" dir="ltr">
      
      {/* HEADER HERO */}
      <div className="relative rounded-3xl overflow-hidden border border-obsidian-850 bg-gradient-to-r from-crimson-950/20 via-obsidian-900 to-obsidian-950 p-8 md:p-12 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-crimson-600/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-crimson-950/40 border border-crimson-800/20 text-xs font-black text-crimson-500 font-mono">
              <Newspaper className="w-3.5 h-3.5 animate-pulse" /> News Portal
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Latest Manga & Anime News</h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Stay up to date with industry announcements, upcoming season releases, author updates, and featured manga spotlights.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-crimson-600 hover:bg-crimson-500 text-white font-black px-5 py-3 rounded-2xl text-xs shadow-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 self-start md:self-center"
            >
              <Plus className="w-4 h-4" /> Publish Article
            </button>
          )}
        </div>
      </div>

      {/* ERROR ALERTS */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/30 text-red-400 p-4 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* COLLAPSIBLE ADD FORM (ADMIN / MODERATOR ONLY) */}
      <AnimatePresence>
        {showAddForm && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="border-b border-obsidian-800 pb-2 flex items-center justify-between">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-crimson-600" /> Write New Article
              </h3>
              <button onClick={() => setShowAddForm(false)} className="text-xs text-neutral-500 hover:text-white">Close</button>
            </div>

            {formSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 p-3 rounded-xl text-xs">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Article Title*:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Catchy title..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Image Cover URL:</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Full Article Content*:</label>
                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the full news story here..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600 leading-relaxed"
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  {formSubmitting ? 'Publishing...' : 'Publish Article'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ARTICLES LIST SECTION */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="border-4 border-crimson-950 border-t-crimson-600 w-10 h-10 rounded-full animate-spin"></span>
          <p className="text-xs text-neutral-500">Loading articles...</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-obsidian-900/50 border border-obsidian-850 rounded-2xl p-16 text-center text-neutral-500">
          No articles published yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map(article => (
            <motion.div
              whileHover={{ y: -5 }}
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className="bg-obsidian-900/40 border border-obsidian-850 hover:border-crimson-900/40 rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between shadow-lg h-[400px]"
            >
              <div className="relative h-48 w-full overflow-hidden shrink-0 border-b border-obsidian-850">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                
                {isAdmin && (
                  <button
                    onClick={(e) => handleDeleteArticle(article.id, e)}
                    className="absolute right-3 top-3 p-2 bg-black/70 hover:bg-red-950 text-neutral-400 hover:text-red-500 rounded-xl transition-all cursor-pointer shadow z-10"
                    title="Delete Article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <span className="text-[10px] bg-crimson-950/40 border border-crimson-800/10 text-crimson-500 font-extrabold px-2.5 py-1 rounded-full font-sans tracking-wide">
                    Industry News
                  </span>
                  <h3 className="font-extrabold text-white text-sm line-clamp-2 hover:text-crimson-500 transition-colors leading-relaxed">
                    {article.title}
                  </h3>
                  <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed">
                    {article.content}
                  </p>
                </div>

                {/* Article Footer info */}
                <div className="flex items-center justify-between text-[10px] text-neutral-500 border-t border-obsidian-850/60 pt-3 font-mono">
                  <div className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-neutral-500" />
                    <span>{article.authorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(article.addedAt)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ARTICLE READ FULL DETAILS MODAL */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian-900 border border-obsidian-800 rounded-3xl w-full max-w-3xl overflow-hidden text-left shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header and banner image */}
              <div className="relative h-56 md:h-72 w-full shrink-0">
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover brightness-[0.45]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-900 to-transparent"></div>
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute right-4 top-4 p-2.5 bg-black/60 hover:bg-crimson-600 text-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Meta details over picture */}
                <div className="absolute bottom-4 left-6 right-6 space-y-2">
                  <span className="inline-block text-[10px] bg-crimson-600 text-white font-extrabold px-3 py-1 rounded-full">
                    Industry News
                  </span>
                  <h2 className="text-xl md:text-3xl font-black text-white leading-tight">
                    {selectedArticle.title}
                  </h2>
                </div>
              </div>

              {/* Scrollable details text */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
                {/* Metadata row */}
                <div className="flex flex-wrap gap-4 items-center justify-start text-xs text-neutral-400 border-b border-obsidian-850 pb-4 font-mono">
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4 text-crimson-600" /> By: <strong>{selectedArticle.authorName}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> {formatDate(selectedArticle.addedAt)}
                  </span>
                </div>

                {/* Main text content */}
                <div className="text-sm md:text-base text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedArticle.content}
                </div>
              </div>

              {/* Close footer bar */}
              <div className="p-4 bg-obsidian-950 border-t border-obsidian-850 flex items-center justify-between shrink-0">
                <p className="text-[10px] text-neutral-500 font-mono">DARK MANHWA News</p>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="bg-obsidian-900 hover:bg-crimson-600 text-neutral-400 hover:text-white px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
