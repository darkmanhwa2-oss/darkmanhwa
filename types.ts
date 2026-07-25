/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'moderator' | 'user';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  role: UserRole;
  avatarUrl: string;
  createdAt: string;
  xp?: number;
  level?: number;
  streak?: number;
  lastReadDate?: string;
  aniListUsername?: string;
  badges?: string[];
}

export interface Series {
  id: string;
  titleAr: string;
  titleEn: string;
  alternativeTitles?: string;
  descriptionAr: string;
  descriptionEn: string;
  coverUrl: string;
  bannerUrl: string;
  author: string;
  artist: string;
  status: 'ongoing' | 'completed' | 'paused' | 'dropped';
  type?: 'manga' | 'manhwa' | 'manhua' | 'novel';
  ageRating?: string;
  releaseYear?: string;
  translator?: string;
  rating: number; // average out of 5
  views: number;
  likes: number;
  genres: string[];
  addedAt: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  number: number;
  titleAr: string;
  titleEn: string;
  pages: string[]; // URLs or local indices
  addedAt: string;
  isVisible: boolean;
  translatorName?: string;
  status?: 'draft' | 'published';
  releaseNote?: string;
}

export interface CommentReply {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  addedAt: string;
}

export interface Comment {
  id: string;
  seriesId: string;
  chapterId?: string; // Optional: can be on series page or chapter page
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  addedAt: string;
  likes: number;
  dislikes: number;
  replies: CommentReply[];
  reportsCount?: number;
}

export interface Rating {
  userId: string;
  seriesId: string;
  score: number; // 1-5
}

export interface Favorite {
  userId: string;
  seriesId: string;
}

export interface ReadingHistoryItem {
  userId: string;
  seriesId: string;
  chapterId: string;
  chapterNumber: number;
  pageNum: number;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'chapter' | 'reply' | 'like' | 'admin';
  read: boolean;
  addedAt: string;
  seriesId?: string;
  chapterId?: string;
}

export interface AdZone {
  id: string;
  name: string;
  position: 'top' | 'bottom' | 'between_chapters' | 'reader_side' | 'sidebar' | 'footer' | 'popunder' | 'interstitial' | 'social_bar' | 'in_page_push' | 'sticky_banner' | 'native_ads';
  active: boolean;
  code: string; // AdSense script/div or custom HTML code
}

export interface SiteSettings {
  siteName: string;
  description: string;
  facebookUrl: string;
  twitterUrl: string;
  discordUrl: string;
  googleAnalyticsId: string;
  googleAdSenseId: string;
  cloudinaryEnabled: boolean;
  smtpServer: string;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  globalAdsEnabled?: boolean;
}

export interface Report {
  id: string;
  type: 'bug' | 'dmca' | 'comment_abuse' | 'request';
  userId?: string;
  userEmail: string;
  description: string;
  targetId?: string; // e.g. comment ID or series ID
  status: 'pending' | 'resolved';
  addedAt: string;
}

export interface AdminLog {
  id: string;
  userEmail: string;
  action: string;
  description: string;
  timestamp: string;
}

export type ReadingStatusType = 'reading' | 'plan_to_read' | 'completed' | 'on_hold' | 'dropped';

export interface UserReadingStatus {
  userId: string;
  seriesId: string;
  status: ReadingStatusType;
  updatedAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string; // supports markdown/text
  imageUrl: string;
  authorId: string;
  authorName: string;
  addedAt: string;
  views: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  leaderName: string;
  membersCount: number;
  discordUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  translatedSeriesCount?: number;
  addedAt: string;
}

