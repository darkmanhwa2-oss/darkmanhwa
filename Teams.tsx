/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Trash2, Globe, Heart, ShieldCheck, Link, Disc, MessageSquare } from 'lucide-react';
import { Team, User } from '../types';
import { apiFetch } from '../lib/api';

interface TeamsProps {
  currentUser: User | null;
  onNavigate: (page: string, params?: any) => void;
}

export default function Teams({ currentUser, onNavigate }: TeamsProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Admin Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [translatedSeriesCount, setTranslatedSeriesCount] = useState(0);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');

  // User apply state
  const [applyingTeamId, setApplyingTeamId] = useState<string | null>(null);
  const [applyText, setApplyText] = useState('');
  const [applyDiscordId, setApplyDiscordId] = useState('');
  const [applyRole, setApplyRole] = useState('translator');
  const [applySuccess, setApplySuccess] = useState('');

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/teams');
      setTeams(res);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Unable to load scanlation teams at the moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description) {
      setError('Team name and description are required.');
      return;
    }

    setFormSubmitting(true);
    setError('');
    setFormSuccess('');

    try {
      const token = localStorage.getItem('dark_watch_token');
      const res = await apiFetch('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description,
          logoUrl,
          leaderName,
          discordUrl,
          facebookUrl,
          websiteUrl,
          translatedSeriesCount: Number(translatedSeriesCount)
        })
      });

      if (res.success) {
        setFormSuccess(res.message);
        setName('');
        setDescription('');
        setLogoUrl('');
        setLeaderName('');
        setDiscordUrl('');
        setFacebookUrl('');
        setWebsiteUrl('');
        setTranslatedSeriesCount(0);
        setShowAddForm(false);
        fetchTeams();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error adding team');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this team?')) return;

    try {
      const token = localStorage.getItem('dark_watch_token');
      const res = await apiFetch(`/api/teams/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.success) {
        fetchTeams();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete team');
    }
  };

  const handleApplyToTeam = (teamId: string) => {
    if (!currentUser) {
      onNavigate('auth');
      return;
    }
    setApplyingTeamId(teamId);
    setApplySuccess('');
    setApplyText('');
    setApplyDiscordId('');
  };

  const submitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyText || !applyDiscordId) {
      alert('Please fill out all fields to submit your application.');
      return;
    }

    setApplySuccess('Application sent successfully! The team leader will contact you via Discord.');
    setTimeout(() => {
      setApplyingTeamId(null);
      setApplySuccess('');
    }, 4000);
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
              <Users className="w-3.5 h-3.5 animate-pulse" /> Creative Partners
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Scanlation & Translation Teams</h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Discover the dedicated teams behind your favorite manga releases. You can also apply to join their ranks as a translator, cleaner, or typesetter!
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-crimson-600 hover:bg-crimson-500 text-white font-black px-5 py-3 rounded-2xl text-xs shadow-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0 self-start md:self-center"
            >
              <Plus className="w-4 h-4" /> Add New Team
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

      {/* ADD TEAM FORM (COLLAPSIBLE - ADMIN ONLY) */}
      <AnimatePresence>
        {showAddForm && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-obsidian-900 border border-obsidian-800 rounded-2xl p-6 space-y-4"
          >
            <div className="border-b border-obsidian-800 pb-2 flex items-center justify-between">
              <h3 className="font-extrabold text-white text-sm">Add New Scanlation Team</h3>
              <button onClick={() => setShowAddForm(false)} className="text-xs text-neutral-500 hover:text-white">Close</button>
            </div>

            {formSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 p-3 rounded-xl text-xs">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleAddTeam} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Team Name*:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asura Scans"
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Leader Name*:</label>
                <input
                  type="text"
                  required
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="e.g. LeaderX"
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-neutral-400 mb-1.5">Description*:</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of the team, specialties, and motto..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Logo URL:</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Translated Series Count:</label>
                <input
                  type="number"
                  value={translatedSeriesCount}
                  onChange={(e) => setTranslatedSeriesCount(Number(e.target.value))}
                  placeholder="25"
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Discord Invite URL:</label>
                <input
                  type="url"
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">Website / Social URL:</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  {formSubmitting ? 'Saving...' : 'Add Team'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TEAMS LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="border-4 border-crimson-950 border-t-crimson-600 w-10 h-10 rounded-full animate-spin"></span>
          <p className="text-xs text-neutral-500">Loading scanlation teams...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-obsidian-900/50 border border-obsidian-850 rounded-2xl p-16 text-center text-neutral-500">
          No teams found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <motion.div
              whileHover={{ y: -5 }}
              key={team.id}
              className="bg-obsidian-900/40 border border-obsidian-850 hover:border-crimson-900/40 rounded-2xl p-6 text-left flex flex-col justify-between gap-5 relative shadow-lg"
            >
              {/* Delete button (Admin Only) */}
              {isAdmin && (
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="absolute right-4 top-4 p-2 bg-obsidian-950 hover:bg-red-950/40 text-neutral-500 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                  title="Delete Team"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Team Identity */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img
                    src={team.logoUrl}
                    alt={team.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-obsidian-800 shrink-0"
                  />
                  <div className="overflow-hidden">
                    <h3 className="font-extrabold text-white text-base truncate">{team.name}</h3>
                    <p className="text-xs text-crimson-500 flex items-center gap-1 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" /> Leader: {team.leaderName}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed min-h-[48px] line-clamp-3">
                  {team.description}
                </p>

                {/* Team Stats */}
                <div className="grid grid-cols-2 gap-2 bg-obsidian-950/60 p-3 rounded-xl border border-obsidian-850/60 text-center font-mono">
                  <div className="space-y-1">
                    <span className="block text-[10px] text-neutral-500">Series</span>
                    <span className="block text-xs font-black text-white">{team.translatedSeriesCount || 0}</span>
                  </div>
                  <div className="space-y-1 border-l border-obsidian-850">
                    <span className="block text-[10px] text-neutral-500">Members</span>
                    <span className="block text-xs font-black text-white">{team.membersCount}</span>
                  </div>
                </div>
              </div>

              {/* Team Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleApplyToTeam(team.id)}
                  className="flex-1 bg-crimson-950/40 hover:bg-crimson-600 hover:text-white border border-crimson-800/20 text-crimson-500 font-extrabold py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Join Team
                </button>

                {team.discordUrl && (
                  <a
                    href={team.discordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-obsidian-950 hover:bg-[#5865F2] hover:text-white border border-obsidian-800 hover:border-transparent text-neutral-400 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                    title="Discord Server"
                  >
                    <Disc className="w-4 h-4" />
                  </a>
                )}

                {team.websiteUrl && (
                  <a
                    href={team.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-obsidian-950 hover:bg-crimson-950/30 hover:text-crimson-500 border border-obsidian-800 text-neutral-400 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                    title="External Website"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* JOIN TEAM MODAL */}
      <AnimatePresence>
        {applyingTeamId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian-900 border border-obsidian-800 rounded-3xl p-6 w-full max-w-lg space-y-4"
            >
              <div className="flex items-center justify-between border-b border-obsidian-800 pb-2">
                <h3 className="font-extrabold text-white text-base">Apply to Join Team</h3>
                <button
                  onClick={() => setApplyingTeamId(null)}
                  className="text-xs text-neutral-500 hover:text-white"
                >
                  Close
                </button>
              </div>

              {applySuccess ? (
                <div className="bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 p-4 rounded-xl text-xs leading-relaxed">
                  {applySuccess}
                </div>
              ) : (
                <form onSubmit={submitApplication} className="space-y-4">
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Submit your application to the team leader. Please provide accurate contact information.
                  </p>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Role / Position*:</label>
                    <select
                      value={applyRole}
                      onChange={(e) => setApplyRole(e.target.value)}
                      className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                    >
                      <option value="translator">Translator (High English proficiency)</option>
                      <option value="cleaner">Cleaner (Image editing / redraws)</option>
                      <option value="typesetter">Typesetter (Typography & font design)</option>
                      <option value="redrawer">Redrawer (Advanced Photoshop artist)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Discord Handle (ID)*:</label>
                    <input
                      type="text"
                      required
                      value={applyDiscordId}
                      onChange={(e) => setApplyDiscordId(e.target.value)}
                      placeholder="e.g. username#1234"
                      className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Experience & Introduction*:</label>
                    <textarea
                      required
                      rows={4}
                      value={applyText}
                      onChange={(e) => setApplyText(e.target.value)}
                      placeholder="Mention past experience, software used, and weekly availability..."
                      className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600"
                    ></textarea>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Submit Application
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyingTeamId(null)}
                      className="px-4 py-2.5 bg-obsidian-950 border border-obsidian-800 text-neutral-400 hover:text-white rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
