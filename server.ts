/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { JSONDatabase, DEFAULT_ADS } from './src/server/db';
import { User, Series, Chapter, Comment, Rating, SiteSettings, AdZone, Report, AdminLog, UserRole, ReadingHistoryItem, NewsArticle, Team } from './src/types';

// Load env variables
dotenv.config();

const app = express();
app.use(compression());
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dark_watch_secret_key_998877';

// Middleware to parse JSON payloads with high limit for uploading images/chapters in base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize the Database
const db = JSONDatabase.get();

// Helper to add XP and Level up
const addXP = (userId: string, amount: number, database: any) => {
  const user = database.users.find((u: any) => u.id === userId);
  if (!user) return;
  
  if (user.xp === undefined) user.xp = 0;
  if (user.level === undefined) user.level = 1;
  if (!user.badges) user.badges = [];
  if (user.streak === undefined) user.streak = 1;

  user.xp += amount;
  
  const newLevel = Math.floor(user.xp / 100) + 1;
  if (newLevel > user.level) {
    user.level = newLevel;
    if (database.notifications) {
      database.notifications.push({
        id: 'notif_level_' + Math.random().toString(36).substr(2, 9),
        userId: user.id,
        title: '🎉 تهانينا! لقد ارتفع مستواك',
        content: `لقد وصلت إلى المستوى ${newLevel}! استمر في القراءة والتفاعل لفتح المزيد من الأوسمة.`,
        type: 'admin',
        read: false,
        addedAt: new Date().toISOString()
      });
    }
  }

  const addBadgeIfMissing = (badge: string) => {
    if (!user.badges.includes(badge)) {
      user.badges.push(badge);
      if (database.notifications) {
        database.notifications.push({
          id: 'notif_badge_' + Math.random().toString(36).substr(2, 9),
          userId: user.id,
          title: '🏅 حصلت على وسام جديد!',
          content: `لقد حصلت على وسام: "${badge}" لكونك عضواً متفاعلاً في مجتمعنا!`,
          type: 'admin',
          read: false,
          addedAt: new Date().toISOString()
        });
      }
    }
  };

  if (user.level >= 3) addBadgeIfMissing('المستكشف المبتدئ');
  if (user.level >= 5) addBadgeIfMissing('القارئ الفضي');
  if (user.level >= 10) addBadgeIfMissing('البطل الأسطوري');
  
  const userCommentsCount = database.comments.filter((c: any) => c.userId === userId).length;
  if (userCommentsCount >= 3) addBadgeIfMissing('الناقد المتفاعل');
  if (userCommentsCount >= 10) addBadgeIfMissing('فيلسوف التعليقات');

  const userReadCount = database.readingHistory.filter((h: any) => h.userId === userId).length;
  if (userReadCount >= 5) addBadgeIfMissing('القارئ النهم');
  if (userReadCount >= 20) addBadgeIfMissing('مدمن المانجا');

  const todayStr = new Date().toISOString().split('T')[0];
  if (user.lastReadDate) {
    const lastRead = new Date(user.lastReadDate);
    const today = new Date(todayStr);
    const diffTime = Math.abs(today.getTime() - lastRead.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      user.streak += 1;
      if (user.streak >= 3) addBadgeIfMissing('مثابر يومي 3 أيام');
      if (user.streak >= 7) addBadgeIfMissing('ملك القراءة الأسبوعية');
    } else if (diffDays > 1) {
      user.streak = 1;
    }
  } else {
    user.streak = 1;
  }
  user.lastReadDate = todayStr;
};

// --- AUTHENTICATION MIDDLEWARES ---
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'تتطلب هذه العملية تسجيل الدخول أولاً' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(401).json({ message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
      return;
    }
    req.user = user;
    next();
  });
};

const requireRole = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'غير مصرح' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء' });
      return;
    }
    next();
  };
};

// Helper for logger
const writeLog = (email: string, action: string, description: string) => {
  const database = JSONDatabase.get();
  const newLog: AdminLog = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    userEmail: email,
    action,
    description,
    timestamp: new Date().toISOString()
  };
  database.logs.unshift(newLog);
  // Keep last 100 logs
  if (database.logs.length > 100) {
    database.logs = database.logs.slice(0, 100);
  }
  JSONDatabase.save(database);
};

// --- AUTH API ---
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  const database = JSONDatabase.get();

  if (!database.settings.registrationEnabled) {
    res.status(400).json({ message: 'تم إيقاف التسجيل حالياً بواسطة الإدارة' });
    return;
  }

  if (!email || !username || !password) {
    res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    return;
  }

  const existingUser = database.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    email: email.toLowerCase(),
    username,
    passwordHash,
    role: 'user',
    avatarUrl: 'https://c.top4top.io/p_38444apdb1.jpg',
    createdAt: new Date().toISOString(),
    xp: 0,
    level: 1,
    streak: 1,
    lastReadDate: '',
    aniListUsername: '',
    badges: ['عضو جديد']
  };

  database.users.push(newUser);
  JSONDatabase.save(database);

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, username: newUser.username, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
      xp: 0,
      level: 1,
      streak: 1,
      lastReadDate: '',
      aniListUsername: '',
      badges: ['عضو جديد']
    }
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const database = JSONDatabase.get();

  if (!email || !password) {
    res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    return;
  }

  const user = database.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(400).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      xp: user.xp || 0,
      level: user.level || 1,
      streak: user.streak || 1,
      lastReadDate: user.lastReadDate || '',
      aniListUsername: user.aniListUsername || '',
      badges: user.badges || []
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const user = database.users.find(u => u.id === req.user?.id);

  if (!user) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      xp: user.xp || 0,
      level: user.level || 1,
      streak: user.streak || 1,
      lastReadDate: user.lastReadDate || '',
      aniListUsername: user.aniListUsername || '',
      badges: user.badges || []
    }
  });
});

app.put('/api/auth/update', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { username, avatarUrl, password, newPassword } = req.body;
  const database = JSONDatabase.get();
  const userIndex = database.users.findIndex(u => u.id === req.user?.id);

  if (userIndex === -1) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }

  const user = database.users[userIndex];

  // Verify old password if trying to change password
  if (newPassword) {
    if (!password) {
      res.status(400).json({ message: 'يرجى إدخال كلمة المرور الحالية لتأكيد التغيير' });
      return;
    }
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
      return;
    }
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
  }

  if (username) user.username = username;
  if (avatarUrl) user.avatarUrl = avatarUrl;

  database.users[userIndex] = user;
  JSONDatabase.save(database);

  res.json({
    message: 'تم تحديث الملف الشخصي بنجاح',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      xp: user.xp || 0,
      level: user.level || 1,
      streak: user.streak || 1,
      lastReadDate: user.lastReadDate || '',
      aniListUsername: user.aniListUsername || '',
      badges: user.badges || []
    }
  });
});

// --- SERIES API ---
app.get('/api/series', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const { search, genre, status, sort, excludeGenre } = req.query;

  let result = [...database.series];

  if (search) {
    const q = (search as string).toLowerCase();
    result = result.filter(s => 
      s.titleAr.toLowerCase().includes(q) || 
      s.titleEn.toLowerCase().includes(q) || 
      s.author.toLowerCase().includes(q)
    );
  }

  if (genre) {
    result = result.filter(s => s.genres.includes(genre as string));
  }

  if (excludeGenre) {
    const genresToExclude = (excludeGenre as string).split(',');
    result = result.filter(s => !s.genres.some(g => genresToExclude.includes(g)));
  }

  if (status) {
    result = result.filter(s => s.status === status);
  }

  // Sorting
  if (sort === 'views') {
    result.sort((a, b) => b.views - a.views);
  } else if (sort === 'likes') {
    result.sort((a, b) => b.likes - a.likes);
  } else if (sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'oldest') {
    result.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
  } else {
    // Default to newest
    result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

  res.json(result);
});

app.get('/api/series/random', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  if (database.series.length === 0) {
    res.status(404).json({ message: 'لا توجد أعمال مضافة' });
    return;
  }
  const randomIndex = Math.floor(Math.random() * database.series.length);
  res.json(database.series[randomIndex]);
});

app.get('/api/series/trending', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  // Sort by views first, then slice top 5
  const trending = [...database.series].sort((a, b) => b.views - a.views).slice(0, 5);
  res.json(trending);
});

app.get('/api/series/:id', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const series = database.series.find(s => s.id === req.params.id);

  if (!series) {
    res.status(404).json({ message: 'العمل غير موجود' });
    return;
  }

  // Increment views securely (avoid spamming inside short periods)
  // We can increment it on load for demonstration but inside client we'll fetch details
  series.views += 1;
  JSONDatabase.save(database);

  const chapters = database.chapters
    .filter(c => c.seriesId === series.id)
    .map(({ pages, ...rest }) => rest) // Exclude heavy pages array to optimize performance and memory!
    .sort((a, b) => b.number - a.number); // Return descending order of chapters

  res.json({ series, chapters });
});

// --- BOOKMARKS & FAVORITES ---
app.post('/api/series/:id/favorite', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;
  const seriesId = req.params.id;

  const existingFav = database.favorites.find(f => f.userId === userId && f.seriesId === seriesId);
  const series = database.series.find(s => s.id === seriesId);

  if (!series) {
    res.status(404).json({ message: 'العمل غير موجود' });
    return;
  }

  if (existingFav) {
    // Remove favorite
    database.favorites = database.favorites.filter(f => !(f.userId === userId && f.seriesId === seriesId));
    series.likes = Math.max(0, series.likes - 1);
    JSONDatabase.save(database);
    res.json({ favorited: false, likes: series.likes });
  } else {
    // Add favorite
    database.favorites.push({ userId, seriesId });
    series.likes += 1;
    JSONDatabase.save(database);
    res.json({ favorited: true, likes: series.likes });
  }
});

app.get('/api/series/:id/is-favorited', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;
  const seriesId = req.params.id;
  const favorited = database.favorites.some(f => f.userId === userId && f.seriesId === seriesId);
  res.json({ favorited });
});

app.get('/api/favorites', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;
  const favSeriesIds = database.favorites.filter(f => f.userId === userId).map(f => f.seriesId);
  const result = database.series.filter(s => favSeriesIds.includes(s.id));
  res.json(result);
});

// --- RATINGS API ---
app.post('/api/series/:id/rate', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { score } = req.body; // 1 to 5
  const seriesId = req.params.id;
  const userId = req.user!.id;

  if (!score || score < 1 || score > 5) {
    res.status(400).json({ message: 'التقييم يجب أن يكون بين 1 و 5 نجوم' });
    return;
  }

  const database = JSONDatabase.get();
  const ratingIndex = database.ratings.findIndex(r => r.userId === userId && r.seriesId === seriesId);

  if (ratingIndex > -1) {
    database.ratings[ratingIndex].score = score;
  } else {
    database.ratings.push({ userId, seriesId, score });
  }

  // Recalculate average rating
  const allRatings = database.ratings.filter(r => r.seriesId === seriesId);
  const totalScore = allRatings.reduce((sum, r) => sum + r.score, 0);
  const avg = Number((totalScore / allRatings.length).toFixed(2));

  const series = database.series.find(s => s.id === seriesId);
  if (series) {
    series.rating = avg;
  }

  // Reward 5 XP for rating a work!
  addXP(userId, 5, database);

  JSONDatabase.save(database);
  res.json({ message: 'تم تقييم العمل بنجاح', rating: avg });
});

// --- COMMENTS API ---
app.get('/api/series/:id/comments', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const comments = database.comments
    .filter(c => c.seriesId === req.params.id)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  res.json(comments);
});

app.post('/api/series/:id/comments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { content, chapterId } = req.body;
  const seriesId = req.params.id;
  const database = JSONDatabase.get();

  if (!content) {
    res.status(400).json({ message: 'محتوى التعليق مطلوب' });
    return;
  }

  const newComment: Comment = {
    id: 'comm_' + Math.random().toString(36).substr(2, 9),
    seriesId,
    chapterId,
    userId: req.user!.id,
    username: req.user!.username,
    userAvatar: req.user!.role === 'admin' ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80' : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(req.user!.username)}`,
    content,
    addedAt: new Date().toISOString(),
    likes: 0,
    dislikes: 0,
    replies: []
  };

  database.comments.push(newComment);
  
  // Reward 10 XP for submitting a comment!
  addXP(req.user!.id, 10, database);

  JSONDatabase.save(database);

  res.status(201).json(newComment);
});

app.post('/api/comments/:commentId/like', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { isDislike } = req.body; // boolean
  const database = JSONDatabase.get();
  const comment = database.comments.find(c => c.id === req.params.commentId);

  if (!comment) {
    res.status(404).json({ message: 'التعليق غير موجود' });
    return;
  }

  if (isDislike) {
    comment.dislikes += 1;
  } else {
    comment.likes += 1;
  }

  JSONDatabase.save(database);
  res.json({ likes: comment.likes, dislikes: comment.dislikes });
});

app.post('/api/comments/:commentId/reply', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { content } = req.body;
  const database = JSONDatabase.get();
  const comment = database.comments.find(c => c.id === req.params.commentId);

  if (!comment) {
    res.status(404).json({ message: 'التعليق الأصلي غير موجود' });
    return;
  }

  if (!content) {
    res.status(400).json({ message: 'محتوى الرد مطلوب' });
    return;
  }

  const reply = {
    id: 'rep_' + Math.random().toString(36).substr(2, 9),
    userId: req.user!.id,
    username: req.user!.username,
    userAvatar: req.user!.role === 'admin' ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80' : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(req.user!.username)}`,
    content,
    addedAt: new Date().toISOString()
  };

  comment.replies.push(reply);
  JSONDatabase.save(database);

  res.status(201).json(reply);
});

// --- CHAPTERS / READER API ---
app.get('/api/chapters/:id', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const chapter = database.chapters.find(c => c.id === req.params.id);

  if (!chapter) {
    res.status(404).json({ message: 'الفصل غير موجود' });
    return;
  }

  const series = database.series.find(s => s.id === chapter.seriesId);

  // Get next and previous chapters for reader page
  const sibChapters = database.chapters
    .filter(c => c.seriesId === chapter.seriesId && c.isVisible)
    .sort((a, b) => a.number - b.number); // Ascending list

  const currentIndex = sibChapters.findIndex(c => c.id === chapter.id);
  const prevChapter = currentIndex > 0 ? sibChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sibChapters.length - 1 ? sibChapters[currentIndex + 1] : null;

  res.json({
    chapter,
    series,
    prevChapter,
    nextChapter,
    allChapters: sibChapters.map(c => ({ id: c.id, number: c.number, titleAr: c.titleAr }))
  });
});

// Image Proxy to bypass hotlinking / referrer restrictions
app.get('/api/image-proxy', async (req: Request, res: Response) => {
  const urlParam = req.query.url as string;
  if (!urlParam) {
    res.status(400).send('URL parameters required');
    return;
  }

  try {
    const targetUrl = decodeURIComponent(urlParam);
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).send('Invalid image URL protocol');
      return;
    }
    const parsedUrl = new URL(targetUrl);
    
    // We can forge headers to bypass anti-hotlinking
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    };

    if (parsedUrl.origin) {
      headers['Referer'] = parsedUrl.origin + '/';
      headers['Origin'] = parsedUrl.origin;
    }

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      // Try again with minimal headers if first try fails
      const backupResponse = await fetch(targetUrl);
      if (!backupResponse.ok) {
        throw new Error(`Failed to fetch image. Status: ${backupResponse.status}`);
      }
      const buffer = await backupResponse.arrayBuffer();
      const contentType = backupResponse.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(Buffer.from(buffer));
      return;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('Image proxy failed for URL:', urlParam, err.message);
    res.redirect(urlParam);
  }
});

app.post('/api/chapters/:id/history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { pageNum, seriesId, chapterNumber } = req.body;
  const chapterId = req.params.id;
  const userId = req.user!.id;
  const database = JSONDatabase.get();

  const existingIndex = database.readingHistory.findIndex(h => h.userId === userId && h.seriesId === seriesId);

  const historyItem: ReadingHistoryItem = {
    userId,
    seriesId,
    chapterId,
    chapterNumber: Number(chapterNumber),
    pageNum: Number(pageNum) || 1,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex > -1) {
    database.readingHistory[existingIndex] = historyItem;
  } else {
    database.readingHistory.push(historyItem);
  }

  // Automatically mark related notifications for this chapter as read
  if (database.notifications) {
    database.notifications.forEach(n => {
      if (n.userId === userId && n.seriesId === seriesId && n.chapterId === chapterId) {
        n.read = true;
      }
    });
  }

  // Reward 15 XP for reading a chapter!
  addXP(userId, 15, database);

  JSONDatabase.save(database);
  res.json({ success: true });
});

app.get('/api/reading-history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;

  const userHistory = database.readingHistory
    .filter(h => h.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const result = userHistory.map(h => {
    const series = database.series.find(s => s.id === h.seriesId);
    const chapter = database.chapters.find(c => c.id === h.chapterId);
    return {
      ...h,
      seriesTitleAr: series?.titleAr || 'عمل محذوف',
      seriesTitleEn: series?.titleEn || 'Deleted Series',
      coverUrl: series?.coverUrl || '',
      chapterTitleAr: chapter?.titleAr || `الفصل ${h.chapterNumber}`
    };
  });

  res.json(result);
});

// --- MY LISTS (READING STATUS) API ---
app.get('/api/users/reading-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;
  const statuses = (database.readingStatuses || []).filter(s => s.userId === userId);
  res.json(statuses);
});

app.get('/api/series/:id/reading-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;
  const seriesId = req.params.id;
  const found = (database.readingStatuses || []).find(s => s.userId === userId && s.seriesId === seriesId);
  res.json({ status: found ? found.status : '' });
});

app.post('/api/series/:id/reading-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const seriesId = req.params.id;
  const { status } = req.body; // 'reading' | 'plan_to_read' | 'completed' | 'on_hold' | 'dropped' or null (delete)
  const database = JSONDatabase.get();
  const userId = req.user!.id;

  if (!database.readingStatuses) database.readingStatuses = [];

  const existingIndex = database.readingStatuses.findIndex(s => s.userId === userId && s.seriesId === seriesId);

  if (!status) {
    if (existingIndex > -1) {
      database.readingStatuses.splice(existingIndex, 1);
    }
  } else {
    const newStatus = {
      userId,
      seriesId,
      status,
      updatedAt: new Date().toISOString()
    };
    if (existingIndex > -1) {
      database.readingStatuses[existingIndex] = newStatus;
    } else {
      database.readingStatuses.push(newStatus);
    }
    
    // Reward 5 XP for organizing!
    addXP(userId, 5, database);
  }

  JSONDatabase.save(database);
  res.json({ success: true, status });
});

// --- ANILIST SYNC API ---
app.post('/api/users/sync-anilist', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.body;
  const database = JSONDatabase.get();
  const user = database.users.find(u => u.id === req.user!.id);

  if (!user) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }

  user.aniListUsername = username;
  if (username) {
    addXP(user.id, 20, database);
  }
  JSONDatabase.save(database);

  res.json({ 
    success: true, 
    aniListUsername: username, 
    message: username ? 'تم ربط ومزامنة حسابك في AniList بنجاح!' : 'تم إلغاء ربط الحساب'
  });
});

// --- CLAIM FREE VIP AD-FREE MEMBERSHIP ---
app.post('/api/users/claim-vip', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const user = database.users.find(u => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }
  if (!user.badges) {
    user.badges = [];
  }
  if (!user.badges.includes('VIP (عضو ذهبي)')) {
    user.badges.push('VIP (عضو ذهبي)');
  }
  JSONDatabase.save(database);
  res.json({ success: true, user, message: 'تهانينا! تم تفعيل العضوية الذهبية VIP وتوقيف الإعلانات مجاناً.' });
});

// --- PUBLIC CONFIG / SETTINGS & ADS ---
app.get('/api/settings', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const globalAdsEnabled = database.settings.globalAdsEnabled !== false;
  res.json({
    settings: database.settings,
    ads: globalAdsEnabled ? database.ads.filter(a => a.active) : []
  });
});

// Submit DMCA or feedback reports
app.post('/api/reports', (req: Request, res: Response) => {
  const { type, email, description, targetId } = req.body;
  const database = JSONDatabase.get();

  if (!email || !description || !type) {
    res.status(400).json({ message: 'البريد الإلكتروني، نوع البلاغ والوصف مطلوبة' });
    return;
  }

  const newReport: Report = {
    id: 'rep_' + Math.random().toString(36).substr(2, 9),
    type,
    userEmail: email,
    description,
    targetId,
    status: 'pending',
    addedAt: new Date().toISOString()
  };

  database.reports.push(newReport);
  JSONDatabase.save(database);

  res.status(201).json({ message: 'تم إرسال بلاغك بنجاح وسيتواصل معك الدعم قريباً' });
});

// --- NEWS & ARTICLES API ---
app.get('/api/news', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const news = database.news || [];
  // Sort by addedAt descending
  const sortedNews = [...news].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  res.json(sortedNews);
});

app.post('/api/news', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { title, content, imageUrl } = req.body;
  if (!title || !content) {
    res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    return;
  }

  const database = JSONDatabase.get();
  if (!database.news) database.news = [];

  const user = database.users.find(u => u.id === req.user!.id);
  const authorName = user ? user.username : 'إدارة دارك واتش';

  const newArticle: NewsArticle = {
    id: 'news_' + Math.random().toString(36).substr(2, 9),
    title,
    content,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&h=400&q=80',
    authorId: req.user!.id,
    authorName,
    addedAt: new Date().toISOString(),
    views: 0
  };

  database.news.push(newArticle);
  JSONDatabase.save(database);

  res.status(201).json({ success: true, article: newArticle, message: 'تم نشر الخبر بنجاح!' });
});

app.delete('/api/news/:id', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const database = JSONDatabase.get();
  const news = database.news || [];

  const index = news.findIndex(n => n.id === id);
  if (index === -1) {
    res.status(404).json({ message: 'الخبر غير موجود' });
    return;
  }

  news.splice(index, 1);
  database.news = news;
  JSONDatabase.save(database);

  res.json({ success: true, message: 'تم حذف الخبر بنجاح!' });
});

// --- TEAMS API ---
app.get('/api/teams', (req: Request, res: Response) => {
  const database = JSONDatabase.get();
  const teams = database.teams || [];
  res.json(teams);
});

app.post('/api/teams', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { name, description, logoUrl, leaderName, discordUrl, facebookUrl, websiteUrl, translatedSeriesCount } = req.body;
  if (!name || !description) {
    res.status(400).json({ message: 'اسم الفريق والوصف مطلوبان' });
    return;
  }

  const database = JSONDatabase.get();
  if (!database.teams) database.teams = [];

  const newTeam: Team = {
    id: 'team_' + Math.random().toString(36).substr(2, 9),
    name,
    description,
    logoUrl: logoUrl || 'https://c.top4top.io/p_38444apdb1.jpg',
    leaderName: leaderName || 'قائد الفريق',
    membersCount: 1,
    discordUrl,
    facebookUrl,
    websiteUrl,
    translatedSeriesCount: translatedSeriesCount || 0,
    addedAt: new Date().toISOString()
  };

  database.teams.push(newTeam);
  JSONDatabase.save(database);

  res.status(201).json({ success: true, team: newTeam, message: 'تمت إضافة الفريق بنجاح!' });
});

app.delete('/api/teams/:id', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const database = JSONDatabase.get();
  const teams = database.teams || [];

  const index = teams.findIndex(t => t.id === id);
  if (index === -1) {
    res.status(404).json({ message: 'الفريق غير موجود' });
    return;
  }

  teams.splice(index, 1);
  database.teams = teams;
  JSONDatabase.save(database);

  res.json({ success: true, message: 'تم حذف الفريق بنجاح!' });
});

// --- NOTIFICATIONS API ENDPOINTS ---
app.get('/api/notifications', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;

  // Initialize notifications array if missing
  if (!database.notifications) {
    database.notifications = [];
  }

  // 1. DYNAMICALLY DETECT NEW CHAPTERS FOR FAVORITED SERIES
  const userFavorites = (database.favorites || []).filter(f => f && f.userId === userId);
  let updatedDb = false;

  userFavorites.forEach(fav => {
    if (!fav || !fav.seriesId) return;
    const series = (database.series || []).find(s => s && s.id === fav.seriesId);
    if (!series) return;

    // Get all visible chapters of this series
    const chapters = (database.chapters || []).filter(c => c && c.seriesId === fav.seriesId && c.isVisible);
    if (chapters.length === 0) return;

    // Sort chapters ascending to process them
    chapters.sort((a, b) => (a.number || 0) - (b.number || 0));

    // Get user's reading history for this series
    const historyItem = (database.readingHistory || []).find(h => h && h.userId === userId && h.seriesId === fav.seriesId);

    // Filter chapters that are considered "new" or "unread"
    let newChapters: Chapter[] = [];
    if (historyItem) {
      newChapters = chapters.filter(c => c && c.number > (historyItem.chapterNumber || 0));
    } else {
      // If no reading history, just notify about the single latest chapter of this series
      const latestChapter = chapters[chapters.length - 1];
      if (latestChapter) {
        newChapters = [latestChapter];
      }
    }

    newChapters.forEach(chap => {
      if (!chap) return;
      const notifId = `new_chap_${userId}_${chap.id}`;
      const exists = (database.notifications || []).some(n => n && n.id === notifId);
      
      if (!exists) {
        database.notifications.push({
          id: notifId,
          userId,
          title: `فصل جديد متاح: ${series.titleAr}`,
          content: `تمت إضافة الفصل ${chap.number} من عملك المفضل. اقرأه الآن!`,
          type: 'chapter',
          read: false,
          addedAt: chap.addedAt || new Date().toISOString(),
          seriesId: series.id,
          chapterId: chap.id
        });
        updatedDb = true;
      }
    });
  });

  if (updatedDb) {
    JSONDatabase.save(database);
  }

  // Return notifications for this user, sorted by date descending
  const userNotifs = (database.notifications || [])
    .filter(n => n && n.userId === userId)
    .sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());

  res.json(userNotifs);
});

app.post('/api/notifications/:id/read', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;
  const notifId = req.params.id;

  if (!database.notifications) {
    database.notifications = [];
  }

  const notif = database.notifications.find(n => n && n.id === notifId && n.userId === userId);
  if (notif) {
    notif.read = true;
    JSONDatabase.save(database);
  }

  res.json({ success: true });
});

app.post('/api/notifications/read-all', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const userId = req.user!.id;

  if (!database.notifications) {
    database.notifications = [];
  }

  database.notifications.forEach(n => {
    if (n && n.userId === userId) {
      n.read = true;
    }
  });

  JSONDatabase.save(database);
  res.json({ success: true });
});

app.get('/api/notifications/unread-count', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const database = JSONDatabase.get();
    const userId = req.user!.id;

    if (!database.notifications) {
      database.notifications = [];
    }

    const userFavorites = (database.favorites || []).filter(f => f && f.userId === userId);
    let updatedDb = false;

    userFavorites.forEach(fav => {
      if (!fav || !fav.seriesId) return;
      const series = (database.series || []).find(s => s && s.id === fav.seriesId);
      if (!series) return;

      const chapters = (database.chapters || []).filter(c => c && c.seriesId === fav.seriesId && c.isVisible !== false);
      if (chapters.length === 0) return;

      chapters.sort((a, b) => (a.number || 0) - (b.number || 0));
      const historyItem = (database.readingHistory || []).find(h => h && h.userId === userId && h.seriesId === fav.seriesId);

      let newChapters: Chapter[] = [];
      if (historyItem) {
        newChapters = chapters.filter(c => c && c.number > (historyItem.chapterNumber || 0));
      } else {
        const latestChapter = chapters[chapters.length - 1];
        if (latestChapter) {
          newChapters = [latestChapter];
        }
      }

      newChapters.forEach(chap => {
        if (!chap) return;
        const notifId = `new_chap_${userId}_${chap.id}`;
        const exists = (database.notifications || []).some(n => n && n.id === notifId);
        
        if (!exists) {
          database.notifications.push({
            id: notifId,
            userId,
            title: `فصل جديد متاح: ${series.titleAr}`,
            content: `تمت إضافة الفصل ${chap.number} من عملك المفضل. اقرأه الآن!`,
            type: 'chapter',
            read: false,
            addedAt: chap.addedAt || new Date().toISOString(),
            seriesId: series.id,
            chapterId: chap.id
          });
          updatedDb = true;
        }
      });
    });

    if (updatedDb) {
      JSONDatabase.save(database);
    }

    const unreadCount = (database.notifications || []).filter(n => n && n.userId === userId && !n.read).length;
    res.json({ unreadCount });
  } catch (err: any) {
    console.error('Error fetching unread count:', err);
    res.json({ unreadCount: 0 });
  }
});

// --- ADMIN API ENDPOINTS ---
app.get('/api/admin/stats', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const totalViews = (database.series || []).reduce((sum, s) => sum + (s?.views || 0), 0);
  const totalLikes = (database.series || []).reduce((sum, s) => sum + (s?.likes || 0), 0);

  res.json({
    usersCount: (database.users || []).length,
    seriesCount: (database.series || []).length,
    chaptersCount: (database.chapters || []).length,
    commentsCount: (database.comments || []).length,
    viewsCount: totalViews,
    likesCount: totalLikes,
    reportsCount: (database.reports || []).filter(r => r?.status === 'pending').length
  });
});

// Admin Series management (Add / Update / Delete)
app.post('/api/admin/series', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { 
    titleAr, titleEn, alternativeTitles, descriptionAr, descriptionEn, 
    coverUrl, bannerUrl, author, artist, status, genres,
    type, ageRating, releaseYear, translator
  } = req.body;
  const database = JSONDatabase.get();

  if (!titleAr || !titleEn || !coverUrl) {
    res.status(400).json({ message: 'العنوان والغلاف مطلوبان' });
    return;
  }

  const id = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const existingSeries = database.series.find(s => s.id === id);
  if (existingSeries) {
    res.status(400).json({ message: 'هذا العمل مسجل مسبقاً (رابط مكرر)' });
    return;
  }

  const newSeries: Series = {
    id,
    titleAr,
    titleEn,
    alternativeTitles: alternativeTitles || '',
    descriptionAr: descriptionAr || '',
    descriptionEn: descriptionEn || '',
    coverUrl,
    bannerUrl: bannerUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&h=500&q=80',
    author: author || 'غير معروف',
    artist: artist || 'غير معروف',
    status: status || 'ongoing',
    type: type || 'manhwa',
    ageRating: ageRating || 'All',
    releaseYear: releaseYear || new Date().getFullYear().toString(),
    translator: translator || '',
    rating: 5.0,
    views: 0,
    likes: 0,
    genres: genres || [],
    addedAt: new Date().toISOString()
  };

  database.series.push(newSeries);
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'إضافة عمل', `تمت إضافة العمل الجديد: ${titleAr}`);

  res.status(201).json(newSeries);
});

app.put('/api/admin/series/:id', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const seriesIndex = database.series.findIndex(s => s.id === req.params.id);

  if (seriesIndex === -1) {
    res.status(404).json({ message: 'العمل غير موجود' });
    return;
  }

  const updated = { ...database.series[seriesIndex], ...req.body };
  database.series[seriesIndex] = updated;
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'تعديل عمل', `تم تعديل بيانات العمل: ${updated.titleAr}`);

  res.json(updated);
});

// Admin Delete All Series Endpoint
app.delete('/api/admin/series-all/delete-all', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const totalDeleted = database.series.length;

  database.series = [];
  database.chapters = [];
  database.comments = [];
  if (database.ratings) database.ratings = [];
  if (database.favorites) database.favorites = [];
  if (database.readingHistory) database.readingHistory = [];
  if (database.reports) database.reports = [];

  JSONDatabase.save(database);

  writeLog(req.user!.email, 'حذف جميع الأعمال', `تم حذف جميع الأعمال وفصولها دفعة واحدة (العدد: ${totalDeleted})`);

  res.json({ message: 'تم حذف جميع الأعمال وكافة الفصول والتعليقات والبيانات المرتبطة بها بنجاح!' });
});

app.delete('/api/admin/series/:id', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const series = database.series.find(s => s.id === req.params.id);

  if (!series) {
    res.status(404).json({ message: 'العمل غير موجود' });
    return;
  }

  database.series = database.series.filter(s => s.id !== req.params.id);
  database.chapters = database.chapters.filter(c => c.seriesId !== req.params.id);
  database.comments = database.comments.filter(c => c.seriesId !== req.params.id);
  if (database.ratings) database.ratings = database.ratings.filter(r => r.seriesId !== req.params.id);
  if (database.favorites) database.favorites = database.favorites.filter(f => f.seriesId !== req.params.id);
  if (database.readingHistory) database.readingHistory = database.readingHistory.filter(h => h.seriesId !== req.params.id);
  if (database.reports) database.reports = database.reports.filter(r => r.targetId !== req.params.id);

  JSONDatabase.save(database);

  writeLog(req.user!.email, 'حذف عمل', `تم حذف العمل وكافة فصوله: ${series.titleAr}`);

  res.json({ message: 'تم حذف العمل بنجاح' });
});

// Admin Chapters management
app.post('/api/admin/chapters', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { seriesId, number, titleAr, titleEn, pages, translatorName, status, releaseNote } = req.body;
  const database = JSONDatabase.get();

  if (!seriesId || !number || !pages || pages.length === 0) {
    res.status(400).json({ message: 'يرجى إدخال اسم العمل، رقم الفصل، ومجلد الصور' });
    return;
  }

  const id = `${seriesId}_c${number}`;
  const existingChapter = database.chapters.find(c => c.id === id);

  if (existingChapter) {
    res.status(400).json({ message: 'هذا الفصل مسجل مسبقاً للعمل الحالي' });
    return;
  }

  const newChapter: Chapter = {
    id,
    seriesId,
    number: Number(number),
    titleAr: titleAr || `الفصل ${number}`,
    titleEn: titleEn || `Chapter ${number}`,
    pages,
    addedAt: new Date().toISOString(),
    isVisible: true,
    translatorName: translatorName || '',
    status: status || 'published',
    releaseNote: releaseNote || ''
  };

  database.chapters.push(newChapter);

  // Send notifications to all bookmarked users
  const bookmarkedUserIds = database.favorites.filter(f => f.seriesId === seriesId).map(f => f.userId);
  const series = database.series.find(s => s.id === seriesId);
  if (series) {
    bookmarkedUserIds.forEach(userId => {
      database.notifications.push({
        id: 'notif_' + Math.random().toString(36).substr(2, 9),
        userId,
        title: `فصل جديد مضاف لـ ${series.titleAr}`,
        content: `تمت إضافة الفصل ${number} من عملك المفضل. اقرأه الآن!`,
        type: 'chapter',
        read: false,
        addedAt: new Date().toISOString()
      });
    });
  }

  JSONDatabase.save(database);

  writeLog(req.user!.email, 'إضافة فصل', `تمت إضافة الفصل ${number} للعمل ${seriesId}`);

  res.status(201).json(newChapter);
});

app.delete('/api/admin/chapters/:id', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const chapter = database.chapters.find(c => c.id === req.params.id);

  if (!chapter) {
    res.status(404).json({ message: 'الفصل غير موجود' });
    return;
  }

  database.chapters = database.chapters.filter(c => c.id !== req.params.id);
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'حذف فصل', `تم حذف الفصل ${chapter.number} للعمل ${chapter.seriesId}`);

  res.json({ message: 'تم حذف الفصل بنجاح' });
});

// Helper to filter out dynamic script blocks, ads, or garbage elements
function isLikelyGarbageOrCode(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  
  if (lower.length < 5) return true;

  // JavaScript / programming syntax indicators
  if (
    lower.includes('function(') || 
    lower.includes('document.') || 
    lower.includes('window.') || 
    lower.includes('appendchild') || 
    lower.includes('createelement') || 
    lower.includes('dataset.') || 
    lower.includes('filter(boolean)') || 
    lower.includes('filter(b)') || 
    lower.includes('script') || 
    lower.includes('class=') || 
    lower.includes('id=') || 
    lower.includes('href=') || 
    lower.includes('var ') || 
    lower.includes('const ') || 
    lower.includes('let ') ||
    lower.includes('zone=') ||
    lower.includes('min.js') ||
    lower.includes('vignette') ||
    lower.includes('{}') ||
    lower.includes('===') ||
    lower.includes('!==') ||
    lower.includes('src=') ||
    lower.includes('analytics') ||
    lower.includes('googletag')
  ) {
    return true;
  }
  
  // Cookie notices or general non-description site junk
  if (
    lower.includes('cookie') || 
    lower.includes('سياسة الخصوصية') || 
    lower.includes('شروط الاستخدام') || 
    lower.includes('تسجيل الدخول') || 
    lower.includes('إنشاء حساب') || 
    lower.includes('جميع الحقوق محفوظة')
  ) {
    return true;
  }
  
  // Too many brackets/curly braces or non-Arabic/non-English letters
  const bracketsCount = (text.match(/[{}[\]()]/g) || []).length;
  if (bracketsCount > 4 && bracketsCount / text.length > 0.05) {
    return true;
  }
  
  return false;
}

// -------------------------------------------------------------------------
// GLOBAL ROBUST SCRAIPNG & NORMALIZATION UTILITIES FOR MANGA DESCRIPTION & GENRES
// -------------------------------------------------------------------------

const GENRE_MAP: Record<string, string> = {
  // English to Arabic mapping & Synonyms
  'action': 'أكشن',
  'adventure': 'مغامرة',
  'fantasy': 'خيال',
  'fantasy/sci-fi': 'خيال',
  'sci-fi': 'خيال علمي',
  'science fiction': 'خيال علمي',
  'shounen': 'شونين',
  'shonen': 'شونين',
  'shoujo': 'شوجو',
  'shojo': 'شوجو',
  'supernatural': 'قوى خارقة',
  'superpowers': 'قوى خارقة',
  'super power': 'قوى خارقة',
  'drama': 'دراما',
  'thriller': 'إثارة',
  'mystery': 'غموض',
  'magic': 'سحر',
  'sports': 'رياضة',
  'sport': 'رياضة',
  'slice of life': 'حياة يومية',
  'isekai': 'إيسيكاي',
  'demons': 'شياطين',
  'demon': 'شياطين',
  'school life': 'مدرسي',
  'school': 'مدرسي',
  'comedy': 'كوميديا',
  'historical': 'تاريخي',
  'martial arts': 'فنون قتالية',
  'romance': 'رومانسية',
  'harem': 'حريم',
  'system': 'نظام',
  'game': 'ألعاب',
  'rpg': 'ألعاب',
  'monsters': 'وحوش',
  'monster': 'وحوش',
  'reincarnation': 'إعادة إحياء',
  'regression': 'زمني',
  'regressor': 'زمني',
  'time travel': 'زمني',
  'seinen': 'سينين',
  'josei': 'جوسي',
  'military': 'عسكري',
  'mecha': 'ميكا',
  'vampire': 'مصاصي دماء',
  'vampires': 'مصاصي دماء',
  'horror': 'رعب',
  'psychological': 'نفسي',
  'tragedy': 'مأساة',
  'apocalypse': 'نهاية العالم',
  'post-apocalypse': 'نهاية العالم',
  'cultivation': 'تطوير/ممارسة',
  'webtoon': 'ويب تون',
  'comic': 'كوميك',
  
  // Arabic spelling variations and normalization
  'أكشن': 'أكشن',
  'اكشن': 'أكشن',
  'أكشين': 'أكشن',
  'مغامره': 'مغامرة',
  'مغامرة': 'مغامرة',
  'مغامرات': 'مغامرة',
  'خيال': 'خيال',
  'فانتازيا': 'خيال',
  'فانتسي': 'خيال',
  'شونين': 'شونين',
  'شوجو': 'شوجو',
  'قوى خارقة': 'قوى خارقة',
  'قوة خارقة': 'قوى خارقة',
  'قوى': 'قوى خارقة',
  'دراما': 'دراما',
  'درامه': 'دراما',
  'إثارة': 'إثارة',
  'اثارة': 'إثارة',
  'تشويق': 'إثارة',
  'غموض': 'غموض',
  'سحر': 'سحر',
  'ساحر': 'سحر',
  'رياضة': 'رياضة',
  'رياضي': 'رياضة',
  'حياة يومية': 'حياة يومية',
  'شريحة من الحياة': 'حياة يومية',
  'إيسيكاي': 'إيسيكاي',
  'ايسيكاي': 'إيسيكاي',
  'ايسكاي': 'إيسيكاي',
  'إيسيكاى': 'إيسيكاي',
  'شياطين': 'شياطين',
  'شيطان': 'شياطين',
  'مدرسي': 'مدرسي',
  'مدرسة': 'مدرسي',
  'كوميديا': 'كوميديا',
  'كوميدي': 'كوميديا',
  'تاريخي': 'تاريخي',
  'تاريخى': 'تاريخي',
  'فنون قتالية': 'فنون قتالية',
  'فنون القتال': 'فنون قتالية',
  'رومانسية': 'رومانسية',
  'رومانسي': 'رومانسية',
  'رومنسي': 'رومانسية',
  'حريم': 'حريم',
  'نظام': 'نظام',
  'سيرفر': 'نظام',
  'ألعاب': 'ألعاب',
  'العاب': 'ألعاب',
  'لعبة': 'ألعاب',
  'وحوش': 'وحوش',
  'إعادة إحياء': 'إعادة إحياء',
  'تجسيد': 'إعادة إحياء',
  'تجسد': 'إعادة إحياء',
  'زمني': 'زمني',
  'سفر عبر الزمن': 'زمني'
};

const EXCLUDED_TAGS = [
  'home', 'الرئيسية', 'الكل', 'all', 'مستمر', 'منتهي', 'منتهية', 'مكتمل', 'مكتملة', 
  'متوقف', 'ترجمة', 'فصل', 'مانهوا', 'مانجا', 'فصول', 'تحميل', 'قراءة', 'اونلاين', 
  'موقع', 'الفصول', 'جديد', 'حصري', 'اون لاين', 'فريق', 'مترجم', 'عربي', 'بالعربية'
];

function normalizeMangaGenre(raw: string): string | null {
  if (!raw) return null;
  
  let normalized = raw.trim().toLowerCase();
  normalized = normalized.replace(/[,;./\\:\-\(\)]/g, ' ').trim();
  
  if (normalized.length < 2 || normalized.length > 25) return null;
  
  if (EXCLUDED_TAGS.some(tag => normalized === tag || normalized.includes(tag))) {
    return null;
  }

  // Exact Match
  if (GENRE_MAP[normalized]) {
    return GENRE_MAP[normalized];
  }

  // Substring English Match
  for (const [engKey, arVal] of Object.entries(GENRE_MAP)) {
    if (normalized === engKey || normalized.includes(engKey)) {
      return arVal;
    }
  }

  // Substring Arabic Match
  for (const [arKey, arVal] of Object.entries(GENRE_MAP)) {
    if (normalized === arKey || normalized.includes(arKey)) {
      return arVal;
    }
  }

  return null;
}

function cleanDescriptionText(text: string): string {
  if (!text) return '';
  
  // Replace known boilerplate strings across the entire text before splitting
  let cleanedText = text
    .replace(/قراءة فصول (مانهوا|مانجا|مانهوا\/مانجا|مانجا\/مانهوا|المانهوا|المانجا) مترجمة .*? كاملة بجودة عالية على موقعنا(\.|)/gi, '')
    .replace(/تابع قصة .*? الأسطورية وتعرف على آخر فصولها أولاً بأول مع تحديثات تلقائية يومية فور صدور الفصول(!|)/gi, '')
    .replace(/تابع قصة .*? وتعرف على آخر فصولها أولاً بأول مع تحديثات تلقائية يومية فور صدور الفصول(!|)/gi, '')
    .replace(/تصنيف العمل\s*:\s*.*?(?=(\n|$))/gi, '')
    .replace(/قراءة ممتعة لجميع الفصول\s*(\.\.|\.)\s*(مانجا|مانهوا|المانجا|المانهوا) مترجمة .*?(\.|)/gi, '')
    .replace(/قراءة ممتعة لجميع الفصول.*?(\.|)/gi, '');

  // Clean line by line
  const lines = cleanedText.split('\n');
  const cleanedLines = lines
    .map(line => {
      let l = line.trim();
      if (!l) return '';
      
      // Remove social links or promotional messages/credits
      if (
        l.match(/https?:\/\/(www\.)?(discord|t\.me|telegram|facebook|twitter|instagram|youtube|github|patreon|paypal|ko-fi|donationalerts|scans|translation|team)/i) ||
        l.includes('دعمنا') ||
        l.includes('الدعم المالي') ||
        l.includes('سيرفرنا') ||
        l.includes('جروبنا') ||
        l.includes('صفحتنا') ||
        l.includes('قناتنا') ||
        l.includes('التليجرام') ||
        l.includes('تليجرام') ||
        l.includes('تليغرام') ||
        l.includes('الديسكورد') ||
        l.includes('ديسكورد') ||
        l.includes('فيس بوك') ||
        l.includes('فيسبوك') ||
        l.includes('انستجرام') ||
        l.includes('تويتر') ||
        l.includes('موقعنا') ||
        l.includes('الموقع الرسمي') ||
        l.includes('تابعونا على') ||
        l.includes('اشتركوا في') ||
        l.includes('انضموا إلينا') ||
        l.includes('زورونا على') ||
        l.includes('تابعونا للمزيد') ||
        l.includes('لا تنسوا تقييم') ||
        l.includes('قراءة ممتعة') ||
        l.includes('حقوق الترجمة محفوظة') ||
        l.includes('ترجمة وإعداد') ||
        l.includes('ترجمة وتبييض') ||
        l.includes('ترجمة و تبييض') ||
        l.includes('الفصل القادم') ||
        l.includes('العمل من ترجمة') ||
        l.includes('موقع أزورا') ||
        l.includes('موقع اوليمبوس') ||
        l.includes('أوليمبوس') ||
        l.includes('أزورا') ||
        l.includes('مانجا ليك') ||
        l.includes('مانجا عرب') ||
        l.includes('سوات') ||
        l.includes('swat') ||
        l.includes('azora') ||
        l.includes('olympus') ||
        l.includes('أريا') ||
        l.includes('golden') ||
        l.includes('سيرفر')
      ) {
        return '';
      }
      return l;
    })
    .filter(Boolean);

  // Return formatted multiline paragraphs
  return cleanedLines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractChapterNumber(text: string, href: string): number {
  const cleanText = text.trim();
  
  // Pattern 1: Look for Arabic/English words like "الفصل", "فصل", "الشابتر", "chapter", "ch", "chap" followed by a number
  const pattern1 = /(الفصل|الشابتر|فصل|chapter|chap|ch|ep|episode|الـفصل|الـشابتر)\s*[-_]?\s*([0-9]+(\.[0-9]+)?)/i;
  const match1 = cleanText.match(pattern1);
  if (match1 && match1[2]) {
    return parseFloat(match1[2]);
  }

  // Pattern 2: Extract from href attribute if it contains "chapter-105-5" or "ch-105"
  if (href) {
    const hrefPattern = /(chapter|chap|ch|فصل)[-_\s]?([0-9]+(\.[0-9]+)?)/i;
    const matchHref = href.match(hrefPattern);
    if (matchHref && matchHref[2]) {
      return parseFloat(matchHref[2]);
    }
  }

  // Pattern 3: Look for any standalone decimal or integer in the text
  const standaloneMatch = cleanText.match(/\b([0-9]+(\.[0-9]+)?)\b/);
  if (standaloneMatch && standaloneMatch[1]) {
    return parseFloat(standaloneMatch[1]);
  }

  // Pattern 4: Any digits
  const anyDigits = cleanText.match(/([0-9]+(\.[0-9]+)?)/);
  if (anyDigits && anyDigits[1]) {
    return parseFloat(anyDigits[1]);
  }

  return 0;
}

// Admin External Chapter/Series Crawler Endpoint
app.post('/api/admin/import-external', authenticateToken, requireRole(['admin', 'moderator']), async (req: AuthenticatedRequest, res: Response) => {
  const { url, type } = req.body;

  if (!url) {
    res.status(400).json({ message: 'يرجى إرسال رابط الموقع المستهدف' });
    return;
  }

  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.replace('www.', '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
          'Referer': parsedUrl.origin
        }
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        res.json({
          success: false,
          cloudflareBlocked: true,
          message: 'انتهت مهلة الاتصال بالخادم (6 ثوانٍ). الرابط بطيء جداً أو مغلق بواسطة حماية جدار الحماية.',
          domain,
          url
        });
        return;
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 403 || response.status === 401 || response.status === 503) {
      res.json({
        success: false,
        cloudflareBlocked: true,
        message: 'عذراً! تم حجب الطلب بواسطة حماية (Cloudflare/DDoS Shield) للرابط المستهدف. يرجى استخدام أداة استخراج الأكواد الذكية أدناه لاستيراد صفحات هذا الفصل في ثانية واحدة وبدون قيود.',
        domain,
        url
      });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Clean up the DOM of script, style, noscript, iframe, ins, etc. to prevent garbage text/ads
    $('script, style, noscript, iframe, ins').remove();

    if (type === 'chapter') {
      let isSeriesUrl = false;
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const segments = pathname.split('/').filter(Boolean);
        
        if (url.includes('/series/')) {
          if (segments.length >= 3) {
            const lastSegment = segments[segments.length - 1];
            if (/^\d+(\.\d+)?$/.test(lastSegment) || /^(chapter|chap|ch|فصل|shapter|ep)/i.test(lastSegment)) {
              isSeriesUrl = false;
            } else {
              isSeriesUrl = true;
            }
          } else {
            isSeriesUrl = true;
          }
        } else if (url.includes('/manga/')) {
          if (segments.length >= 3) {
            const lastSegment = segments[segments.length - 1];
            if (/^\d+(\.\d+)?$/.test(lastSegment) || /^(chapter|chap|ch|فصل|shapter|ep)/i.test(lastSegment)) {
              isSeriesUrl = false;
            } else {
              isSeriesUrl = true;
            }
          } else {
            isSeriesUrl = !url.includes('/chapter') && !url.includes('/chap') && !url.includes('/ch-') && !url.match(/\/ch\d+/i) && !url.match(/\/chapter-\d+/i) && !url.match(/-chapter-\d+/i);
          }
        } else {
          isSeriesUrl = !url.includes('/chapter') && !url.includes('/chap') && !url.includes('/ch-') && !url.match(/\/ch\d+/i) && !url.match(/\/chapter-\d+/i) && !url.match(/-chapter-\d+/i);
        }
      } catch (e) {
        isSeriesUrl = url.includes('/series/') || (url.includes('/manga/') && !url.includes('/chapter') && !url.includes('/chap') && !url.includes('/ch-'));
      }

      if (isSeriesUrl) {
        // Try to scrape chapter list from the series page!
        const chaptersList: { number: string; title: string; url: string }[] = [];
        
        $('.wp-manga-chapter a, .chapter-link a, li.sub-chap a, .chapters-list a, .chapter-list a, .list-group-item a, a.chapter-link').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim();
          if (href) {
            const cleanHref = href.trim();
            if (
              cleanHref.startsWith('#') || 
              cleanHref.startsWith('javascript:') || 
              cleanHref.startsWith('mailto:') || 
              cleanHref.startsWith('tel:')
            ) {
              return; // Skip non-web links
            }
            let num = '';
            const numMatch = title.match(/(الفصل|chapter|chap|ch|الشابتر|فصل)\s*(\d+(\.\d+)?)/i);
            if (numMatch && numMatch[2]) {
              num = numMatch[2];
            } else {
              const hrefMatch = cleanHref.match(/(chapter|chap|ch|فصل|shapter)[-_\s]?(\d+(\.\d+)?)/i);
              if (hrefMatch && hrefMatch[2]) {
                num = hrefMatch[2];
              }
            }
            if (num) {
              try {
                let absoluteUrl = '';
                if (cleanHref.startsWith('//')) {
                  absoluteUrl = `https:${cleanHref}`;
                } else if (cleanHref.startsWith('http://') || cleanHref.startsWith('https://')) {
                  absoluteUrl = cleanHref;
                } else {
                  absoluteUrl = new URL(cleanHref, url).href;
                }
                chaptersList.push({
                  number: num,
                  title: title || `الفصل ${num}`,
                  url: absoluteUrl
                });
              } catch (e) {
                // Ignore parsing errors for invalid relative urls
              }
            }
          }
        });

        if (chaptersList.length === 0) {
          // Smart path-based matching (e.g. if we are on /series/slug and there is a link /series/slug/1 or /series/slug/chapter-1)
          $('a').each((_, el) => {
            const href = $(el).attr('href');
            const title = $(el).text().trim();
            if (!href) return;

            let absoluteHref = href;
            if (href.startsWith('//')) {
              absoluteHref = `https:${href}`;
            } else if (href.startsWith('/')) {
              absoluteHref = `${parsedUrl.origin}${href}`;
            }

            try {
              const hUrl = new URL(absoluteHref);
              // Clean paths of double slashes
              const cleanSeriesPath = parsedUrl.pathname.replace(/\/+/g, '/');
              const cleanLinkPath = hUrl.pathname.replace(/\/+/g, '/');
              if (hUrl.origin === parsedUrl.origin && cleanLinkPath.startsWith(cleanSeriesPath)) {
                const relPath = cleanLinkPath.substring(cleanSeriesPath.length);
                const subSegments = relPath.split('/').filter(Boolean);
                if (subSegments.length === 1) {
                  const potentialNum = subSegments[0];
                  let num = '';
                  const numMatch = potentialNum.match(/^(?:chapter[-_]?)?(\d+(?:\.\d+)?)$/i);
                  if (numMatch) {
                    num = numMatch[1];
                  } else {
                    const generalMatch = potentialNum.match(/(\d+(?:\.\d+)?)/);
                    if (generalMatch) {
                      num = generalMatch[1];
                    }
                  }

                  if (num) {
                    chaptersList.push({
                      number: num,
                      title: title || `الفصل ${num}`,
                      url: absoluteHref
                    });
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          });
        }

        if (chaptersList.length === 0) {
          $('a').each((_, el) => {
            const href = $(el).attr('href');
            const title = $(el).text().trim();
            if (href && (href.includes('chapter') || href.includes('chap') || href.includes('ch-') || title.includes('الفصل') || title.includes('chapter') || title.includes('الشابتر'))) {
              let num = '';
              const numMatch = title.match(/(الفصل|chapter|chap|ch|الشابتر|فصل)\s*(\d+(\.\d+)?)/i);
              if (numMatch && numMatch[2]) {
                num = numMatch[2];
              } else {
                const hrefMatch = href.match(/(chapter|chap|ch|فصل)[-_\s]?(\d+(\.\d+)?)/i);
                if (hrefMatch && hrefMatch[2]) {
                  num = hrefMatch[2];
                }
              }
              if (num) {
                chaptersList.push({
                  number: num,
                  title: title || `الفصل ${num}`,
                  url: href.startsWith('//') ? `https:${href}` : href.startsWith('/') ? `${parsedUrl.origin}${href}` : href
                });
              }
            }
          });
        }

        const uniqueChapters = chaptersList.reduce((acc, current) => {
          const x = acc.find(item => item.url === current.url || item.number === current.number);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, [] as typeof chaptersList);

        uniqueChapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

        if (uniqueChapters.length > 0) {
          res.json({
            success: true,
            isSeriesPage: true,
            chapters: uniqueChapters,
            message: `تم العثور على ${uniqueChapters.length} فصل في هذا العمل بنجاح! يرجى اختيار الفصل المراد جلب صفحاته من القائمة المنسدلة أدناه.`
          });
          return;
        } else {
          res.json({
            success: false,
            isSeriesPage: true,
            cloudflareBlocked: true,
            message: 'لقد قمت بإدخال رابط العمل الرئيسي وليس رابط فصل. ولم نتمكن من قراءة قائمة الفصول بداخله تلقائياً بسبب جدار الحماية (Cloudflare) الخاص بالموقع. يرجى الدخول إلى أي فصل داخل ذلك الموقع، ثم نسخ ولصق كود الاستخراج المساعد أدناه للحصول على صفحات الفصل فوراً وبسهولة!'
          });
          return;
        }
      }

      const pageUrls: string[] = [];
      
      // Try typical selectors for Madara theme (manga-starz) and custom ones (olympustaff)
      // 1. Madara WP-Manga
      $('.wp-manga-chapter-img, .page-break img, .chapter-content img, .chapter-images img').each((_, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-cdn-src') || $(el).attr('srcset') || $(el).attr('data-srcset') || '';
        if (src) {
          src = src.trim();
          if (src.includes(' ')) {
            src = src.split(',')[0].trim().split(' ')[0].trim();
          }
          pageUrls.push(src);
        }
      });

      // 2. OlympusScans / OlympusStaff / WebNovel
      if (pageUrls.length === 0) {
        $('.reader-area img, .reader-image img, #readerarea img, .read-container img, .wp-manga-chapter-img').each((_, el) => {
          let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-cdn-src') || $(el).attr('srcset') || $(el).attr('data-srcset') || '';
          if (src) {
            src = src.trim();
            if (src.includes(' ')) {
              src = src.split(',')[0].trim().split(' ')[0].trim();
            }
            pageUrls.push(src);
          }
        });
      }

      // 3. Generic fallback for any image in reader area (excluding logos, icons, flag, banners, etc)
      if (pageUrls.length === 0) {
        $('img').each((_, el) => {
          let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-cdn-src') || $(el).attr('srcset') || $(el).attr('data-srcset') || $(el).attr('data-altsrc') || '';
          if (src) {
            src = src.trim();
            if (src.includes(' ')) {
              src = src.split(',')[0].trim().split(' ')[0].trim();
            }
            const lowerSrc = src.toLowerCase();
            const isDecorative = lowerSrc.includes('logo') || 
                                 lowerSrc.includes('avatar') || 
                                 lowerSrc.includes('flag') || 
                                 lowerSrc.includes('loader') || 
                                 lowerSrc.includes('loading') || 
                                 lowerSrc.includes('icon') || 
                                 lowerSrc.includes('banner') || 
                                 lowerSrc.includes('header') || 
                                 lowerSrc.includes('footer') || 
                                 lowerSrc.includes('star') || 
                                 lowerSrc.includes('pixel') || 
                                 lowerSrc.includes('gravatar') || 
                                 lowerSrc.includes('facebook') || 
                                 lowerSrc.includes('twitter') || 
                                 lowerSrc.includes('discord') || 
                                 lowerSrc.includes('telegram') || 
                                 lowerSrc.includes('button') || 
                                 lowerSrc.includes('widget') ||
                                 lowerSrc.includes('ad-') ||
                                 lowerSrc.includes('advertisement');

            if (!isDecorative && (
              lowerSrc.includes('chapter') || 
              lowerSrc.includes('page') || 
              lowerSrc.includes('uploads/manga') || 
              lowerSrc.includes('wp-content/uploads') || 
              lowerSrc.includes('storage/photos') || 
              lowerSrc.includes('manga-') ||
              /\.(jpg|jpeg|png|webp|gif)/i.test(lowerSrc) ||
              lowerSrc.includes('/images/') ||
              lowerSrc.includes('/uploads/') ||
              lowerSrc.includes('/media/') ||
              lowerSrc.includes('/storage/') ||
              lowerSrc.includes('/wp-content/')
            )) {
              pageUrls.push(src);
            }
          }
        });
      }

      // Clean page URLs (ensure no duplicates, properly formatted)
      const cleanPages = Array.from(new Set(pageUrls))
        .filter(p => p.startsWith('http') || p.startsWith('//') || p.startsWith('/'))
        .map(p => {
          if (p.startsWith('//')) return `https:${p}`;
          if (p.startsWith('/')) return `${parsedUrl.origin}${p}`;
          return p;
        });

      if (cleanPages.length === 0) {
        res.json({
          success: false,
          cloudflareBlocked: true,
          message: 'لم نتمكن من العثور على صور الفصل برمجياً بسبب نظام الحماية أو بنية الصفحة المتغيرة. يرجى استخدام طريقتنا السريعة والذكية لاستيراد الفصل يدوياً.',
          domain,
          url
        });
        return;
      }

      // Guess chapter number
      let chapterNumber = '1';
      const numberMatch = url.match(/(chapter|الفصل|chap|ch|فصل|fsl|shapter)[-_\s]?(\d+(\.\d+)?)/i);
      if (numberMatch && numberMatch[2]) {
        chapterNumber = numberMatch[2];
      } else {
        // Look for digits in the URL segments
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        for (const segment of segments.reverse()) {
          const segMatch = segment.match(/(\d+(\.\d+)?)/);
          if (segMatch) {
            chapterNumber = segMatch[1];
            break;
          }
        }
      }

      res.json({
        success: true,
        type: 'chapter',
        chapterNumber,
        pages: cleanPages,
        titleAr: `الفصل ${chapterNumber}`,
        titleEn: `Chapter ${chapterNumber}`,
        message: `تم جلب الفصل ${chapterNumber} بنجاح! تم استخراج ${cleanPages.length} صفحة صورة.`
      });

    } else {
      // Import entire Manga/Series Details with ultra-professional multi-selector & auto-cleaning
      let titleAr = '';
      const titleSelectors = [
        '.series-title h1', '.manga-title h1', '.post-title h1', 
        '.entry-title', '.anime-title', '.manga-name',
        'h1.text-xl', 'h1.font-bold', 'h1', 'title'
      ];
      
      for (const sel of titleSelectors) {
        const text = $(sel).first().text().trim();
        if (text && text.length > 2 && text !== 'Home' && text !== 'الرئيسية') {
          titleAr = text;
          break;
        }
      }
      
      if (titleAr) {
        titleAr = titleAr
          .replace(/\s*-\s*Olympus Scans.*/i, '')
          .replace(/\s*-\s*أوليمبوس.*/i, '')
          .replace(/\s*-\s*أزورا.*/i, '')
          .replace(/\s*-\s*Azora.*/i, '')
          .replace(/\s*-\s*Manga.*/i, '')
          .replace(/\s*-\s*مانجا.*/i, '')
          .trim();
      }
      
      if (!titleAr) {
        titleAr = 'عمل جديد مستورد';
      }

      let titleEn = '';
      const altTitleSelectors = [
        '.alternative-title', '.alternative', '.alt-title', 
        '.manga-title-en', '.manga-alt-title', '.post-title h2', 
        'h2.text-sm', 'h2.text-xs', 'h2.font-medium'
      ];
      
      for (const sel of altTitleSelectors) {
        const text = $(sel).first().text().trim();
        if (text && text.length > 2 && /^[a-zA-Z0-9\s\-_:!?,.()'&]+$/.test(text)) {
          titleEn = text;
          break;
        }
      }
      
      if (!titleEn) {
        const slug = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
        titleEn = slug.replace(/[-_]/g, ' ')
          .replace(/\b[a-z]/g, char => char.toUpperCase());
      }
      
      let coverUrl = '';
      
      // 1. Try meta tags first as they are extremely robust and bypass lazy-loading completely!
      const metaOgImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('link[rel="image_src"]').attr('href');
      if (metaOgImage) {
        const src = metaOgImage.trim();
        if (src && !src.startsWith('data:image') && !src.includes('avatar') && !src.includes('logo') && !src.includes('banner') && !src.includes('placeholder')) {
          coverUrl = src;
        }
      }
      
      // 2. Try specific selectors if meta tag is not found
      if (!coverUrl) {
        const coverSelectors = [
          '.summary_image img', '.manga-cover img', '.entry-header img', 
          'img.wp-post-image', '.tab-summary img', '.anime-cover img', 
          '.manga-poster img', '.series-cover img', '.series-poster img', 
          '.cover-img img', '.poster-img', '.series-header img', 
          '.series-info img', '.manga-info img'
        ];
        
        for (const sel of coverSelectors) {
          const imgEl = $(sel).first();
          if (imgEl.length > 0) {
            const src = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || imgEl.attr('data-cfsrc') || imgEl.attr('data-cdn-src') || imgEl.attr('srcset') || '';
            if (src && !src.startsWith('data:image') && !src.includes('avatar') && !src.includes('logo') && !src.includes('banner') && !src.includes('placeholder')) {
              coverUrl = src.trim();
              break;
            }
          }
        }
      }
      
      // 3. Fallback to general image searching
      if (!coverUrl) {
        $('img').each((_, el) => {
          const src = $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('src') || $(el).attr('data-cfsrc') || $(el).attr('data-cdn-src') || '';
          if (src && !src.startsWith('data:image') && (src.includes('cover') || src.includes('poster') || src.includes('uploads/manga') || src.includes('wp-content/uploads') || src.includes('series') || src.includes('manga-')) && !src.includes('avatar') && !src.includes('logo') && !src.includes('placeholder')) {
            coverUrl = src.trim();
            return false;
          }
        });
      }
      
      if (coverUrl) {
        if (coverUrl.includes(' ')) {
          coverUrl = coverUrl.split(',')[0].trim().split(' ')[0].trim();
        }
        if (coverUrl.startsWith('//')) {
          coverUrl = `https:${coverUrl}`;
        } else if (coverUrl.startsWith('/')) {
          coverUrl = `${parsedUrl.origin}${coverUrl}`;
        }
      }

      // 4. Try to get clean description from meta tags as an excellent candidate
      const metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('meta[name="twitter:description"]').attr('content');
      let cleanMetaDesc = '';
      if (metaDesc) {
        const dText = cleanDescriptionText(metaDesc);
        if (dText.length > 20 && !isLikelyGarbageOrCode(dText)) {
          cleanMetaDesc = dText;
        }
      }

      let descriptionAr = '';
      const descSelectors = [
        '.manga-excerpt', '.summary-content', '.entry-content', 
        '.description-summary', '.manga-summary', '.post-content_item .post-content', 
        '.manga-description', '.manga-desc', '.series-description', 
        '.story-desc', '.series-synopsis', '.synopsis', '#synopsis', 
        '.description', '.excerpt', '.post-content', '.story',
        'div[itemprop="description"]', 'p.review-content'
      ];
      
      for (const sel of descSelectors) {
        const el = $(sel).first();
        if (el.length > 0) {
          const paragraphs: string[] = [];
          const pTags = el.find('p, span, div');
          if (pTags.length > 0) {
            pTags.each((_, p) => {
              const pText = $(p).text().trim();
              if (pText && pText.length > 5 && !isLikelyGarbageOrCode(pText)) {
                const cleanedText = cleanDescriptionText(pText);
                if (cleanedText && cleanedText.length > 5) {
                  paragraphs.push(cleanedText);
                }
              }
            });
          }

          let combined = '';
          if (paragraphs.length > 0) {
            const uniqParas = Array.from(new Set(paragraphs));
            combined = uniqParas.join('\n\n');
          } else {
            combined = cleanDescriptionText(el.text());
          }

          if (combined && combined.length > 15 && !isLikelyGarbageOrCode(combined)) {
            descriptionAr = combined;
            break;
          }
        }
      }
      
      if (!descriptionAr && cleanMetaDesc) {
        descriptionAr = cleanMetaDesc;
      }

      if (!descriptionAr) {
        $('p, div').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 50 && text.length < 1500 && !isLikelyGarbageOrCode(text)) {
            if ($(el).parents('footer, header, nav, #sidebar, .sidebar, .comments, .comment').length === 0) {
              const cleaned = cleanDescriptionText(text);
              if (cleaned && cleaned.length > 30) {
                descriptionAr = cleaned;
                return false;
              }
            }
          }
        });
      }

      const genresSet = new Set<string>();

      // 1. Extract from standard selectors
      const infoSelectors = [
        '.genres-content a', '.manga-genres a', '.manga-info-list a', '.genres a', '.manga-info a',
        '.genres-container a', '.genre-item', '.genre-link', '.tag-item', '.tags-container a',
        '.series-genres a', '.series-genre a', '.post-content_item a', '.post-meta a', '.summary-content a',
        '.manga-metadata a', '.gcon a', '.post-content_item:contains("Genre") a',
        '.post-content_item:contains("التصنيف") a', '.post-content_item:contains("تصنيف") a',
        '.post-content_item:contains("النوع") a', '.post-content_item:contains("نوع") a',
        '.post-content_item:contains("الوسوم") a', '.post-content_item:contains("وسوم") a',
        '.post-content_item:contains("Tags") a', '.post-content_item:contains("tags") a'
      ];
      
      $(infoSelectors.join(', ')).each((_, el) => {
        const text = $(el).text();
        const genre = normalizeMangaGenre(text);
        if (genre) genresSet.add(genre);
      });
      
      // 2. Extract slug from URL if links are found
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text() || '';
        
        // Add the anchor text itself
        if (href.includes('/genre/') || href.includes('/genres/') || href.includes('/tag/') || href.includes('/tags/') || href.includes('/manga-genre/') || href.includes('/series-genre/') || href.includes('/series-tag/')) {
          const genreText = normalizeMangaGenre(text);
          if (genreText) genresSet.add(genreText);
          
          // Smart extraction of slug from URL path (e.g. /genre/martial-arts/ -> martial arts)
          const match = href.match(/\/(?:genre|genres|tag|tags|manga-genre|series-genre|series-tag)\/([^/]+)/i);
          if (match && match[1]) {
            const slug = match[1].replace(/-/g, ' ').replace(/_/g, ' ');
            const genreSlug = normalizeMangaGenre(slug);
            if (genreSlug) genresSet.add(genreSlug);
          }
        }
      });

      // 3. Scan all texts inside the details panel for known Arabic genre names
      const infoPanelText = $('.post-content_item, .manga-info, .summary-content, .genres-content, .series-genres, .post-meta, .manga-metadata').text();
      if (infoPanelText) {
        // Run a dictionary check on the details panel
        for (const [key, val] of Object.entries(GENRE_MAP)) {
          // If the text has the exact Arabic keyword as a standalone word or tag
          if (infoPanelText.includes(key)) {
            genresSet.add(val);
          }
        }
      }

      // Analyze title and description for intelligent auto-classification
      const contentToAnalyze = `${titleAr} ${titleEn} ${descriptionAr}`.toLowerCase();
      
      if (contentToAnalyze.includes('نظام') || contentToAnalyze.includes('system') || contentToAnalyze.includes('النافذة') || contentToAnalyze.includes('الرسالة الزرقاء') || contentToAnalyze.includes('اللفل') || contentToAnalyze.includes('مستوى')) {
        genresSet.add('نظام');
      }
      if (contentToAnalyze.includes('إعادة إحياء') || contentToAnalyze.includes('تجسيد') || contentToAnalyze.includes('تجسد') || contentToAnalyze.includes('reincarnat') || contentToAnalyze.includes('reborn')) {
        genresSet.add('إعادة إحياء');
      }
      if (contentToAnalyze.includes('زمني') || contentToAnalyze.includes('الزمن') || contentToAnalyze.includes('الماضي') || contentToAnalyze.includes('تراجع') || contentToAnalyze.includes('سفر عبر الزمن') || contentToAnalyze.includes('regress') || contentToAnalyze.includes('time travel')) {
        genresSet.add('زمني');
      }
      if (contentToAnalyze.includes('سحر') || contentToAnalyze.includes('ساحر') || contentToAnalyze.includes('شعوذة') || contentToAnalyze.includes('تعاويذ') || contentToAnalyze.includes('magic') || contentToAnalyze.includes('mage') || contentToAnalyze.includes('wizard')) {
        genresSet.add('سحر');
      }
      if (contentToAnalyze.includes('برج') || contentToAnalyze.includes('بوابة') || contentToAnalyze.includes('بوابات') || contentToAnalyze.includes('أبراج') || contentToAnalyze.includes('tower') || contentToAnalyze.includes('gate')) {
        genresSet.add('مغامرة');
        genresSet.add('خيال');
      }
      if (contentToAnalyze.includes('ألعاب') || contentToAnalyze.includes('لعبة') || contentToAnalyze.includes('افتراضية') || contentToAnalyze.includes('rpg') || contentToAnalyze.includes('game')) {
        genresSet.add('ألعاب');
      }
      if (contentToAnalyze.includes('أكشن') || contentToAnalyze.includes('قتال') || contentToAnalyze.includes('معركة') || contentToAnalyze.includes('معارك') || contentToAnalyze.includes('action') || contentToAnalyze.includes('combat') || contentToAnalyze.includes('fight')) {
        genresSet.add('أكشن');
      }
      if (contentToAnalyze.includes('فنون قتالية') || contentToAnalyze.includes('سيف') || contentToAnalyze.includes('سيوف') || contentToAnalyze.includes('سياف') || contentToAnalyze.includes('موريم') || contentToAnalyze.includes('murim') || contentToAnalyze.includes('martial arts')) {
        genresSet.add('فنون قتالية');
      }
      if (contentToAnalyze.includes('رعب') || contentToAnalyze.includes('مخيف') || contentToAnalyze.includes('horror') || contentToAnalyze.includes('scary')) {
        genresSet.add('رعب');
      }
      if (contentToAnalyze.includes('رومانسية') || contentToAnalyze.includes('رومانسي') || contentToAnalyze.includes('زواج') || contentToAnalyze.includes('حب') || contentToAnalyze.includes('عشق') || contentToAnalyze.includes('زوجي') || contentToAnalyze.includes('زوجتي') || contentToAnalyze.includes('romance') || contentToAnalyze.includes('love')) {
        genresSet.add('رومانسية');
      }
      if (contentToAnalyze.includes('غموض') || contentToAnalyze.includes('mystery')) {
        genresSet.add('غموض');
      }
      if (contentToAnalyze.includes('دراما') || contentToAnalyze.includes('drama')) {
        genresSet.add('دراما');
      }
      if (contentToAnalyze.includes('كوميديا') || contentToAnalyze.includes('كوميدي') || contentToAnalyze.includes('مضحك') || contentToAnalyze.includes('comedy') || contentToAnalyze.includes('funny')) {
        genresSet.add('كوميديا');
      }
      if (contentToAnalyze.includes('تاريخي') || contentToAnalyze.includes('إمبراطور') || contentToAnalyze.includes('قصر') || contentToAnalyze.includes('عصر') || contentToAnalyze.includes('historical') || contentToAnalyze.includes('royal')) {
        genresSet.add('تاريخي');
      }
      if (contentToAnalyze.includes('شياطين') || contentToAnalyze.includes('وحوش') || contentToAnalyze.includes('شيطان') || contentToAnalyze.includes('وحش') || contentToAnalyze.includes('demon') || contentToAnalyze.includes('monster')) {
        genresSet.add('شياطين');
      }
      if (contentToAnalyze.includes('شونين') || contentToAnalyze.includes('shounen') || contentToAnalyze.includes('shonen')) {
        genresSet.add('شونين');
      }
      
      const genres = Array.from(genresSet);

      let author = 'غير معروف';
      let artist = 'غير معروف';
      
      const authorText = $('.author-content a, .manga-author, .author-name, .author, .series-author').first().text().trim();
      if (authorText && authorText.length > 1 && authorText !== 'غير معروف') {
        author = authorText;
      }
      
      const artistText = $('.artist-content a, .manga-artist, .artist-name, .artist, .series-artist').first().text().trim();
      if (artistText && artistText.length > 1 && artistText !== 'غير معروف') {
        artist = artistText;
      }
      
      $('*').each((_, el) => {
        if ($(el).children().length > 3) return;
        const text = $(el).text().trim();
        
        if (/^(المؤلف|الكاتب|Author|Writer)\s*:/i.test(text)) {
          let val = text.replace(/^(المؤلف|الكاتب|Author|Writer)\s*:\s*/i, '').trim();
          if (!val) {
            val = $(el).next().text().trim() || $(el).parent().text().replace(text, '').trim();
          }
          if (val && val.length > 1 && val.length < 50) {
            author = val;
          }
        }
        if (/^(الرسام|الرسامين|Artist|Illustrator)\s*:/i.test(text)) {
          let val = text.replace(/^(الرسام|الرسامين|Artist|Illustrator)\s*:\s*/i, '').trim();
          if (!val) {
            val = $(el).next().text().trim() || $(el).parent().text().replace(text, '').trim();
          }
          if (val && val.length > 1 && val.length < 50) {
            artist = val;
          }
        }
      });

      res.json({
        success: true,
        type: 'series',
        series: {
          titleAr,
          titleEn: titleEn.trim(),
          descriptionAr,
          coverUrl,
          author,
          artist,
          genres
        }
      });
    }
  } catch (error: any) {
    res.json({ 
      success: false,
      message: 'فشل في الاتصال بالموقع المستهدف أو حدث خطأ أثناء التحليل: ' + error.message,
      cloudflareBlocked: true,
      url
    });
  }
});

// Admin Settings
app.get('/api/admin/settings', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  res.json(database.settings);
});

app.put('/api/admin/settings', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  database.settings = { ...database.settings, ...req.body };
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'تحديث الإعدادات', 'تمت إعادة ضبط إعدادات الموقع الرئيسية والإعلانات');

  res.json({ message: 'تم حفظ الإعدادات بنجاح', settings: database.settings });
});

// Admin Ads management
app.get('/api/admin/ads', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  res.json(database.ads);
});

app.post('/api/admin/ads/reset-defaults', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  for (const defAd of DEFAULT_ADS) {
    const idx = database.ads.findIndex(a => a.id === defAd.id);
    if (idx === -1) {
      database.ads.push({ ...defAd });
    }
  }
  JSONDatabase.save(database);
  writeLog(req.user!.email, 'إعادة تعيين الإعلانات', 'تم استعادة وإضافة جميع المساحات الإعلانية الافتراضية');
  res.json(database.ads);
});

app.post('/api/admin/ads', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const { name, position, code, active } = req.body;
  
  const newAd: AdZone = {
    id: 'ad_' + Date.now(),
    name: name || 'مساحة إعلانية جديدة',
    position: position || 'top',
    code: code || '',
    active: active !== undefined ? active : true
  };

  database.ads.push(newAd);
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'إضافة مساحة إعلانية', `تم إنشاء مساحة إعلانية جديدة: ${newAd.name}`);
  res.json(newAd);
});

app.put('/api/admin/ads/:id', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const adIndex = database.ads.findIndex(a => a.id === req.params.id);

  if (adIndex === -1) {
    res.status(404).json({ message: 'الإعلان غير موجود' });
    return;
  }

  database.ads[adIndex] = { ...database.ads[adIndex], ...req.body };
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'تعديل الإعلانات', `تم تعديل إعدادات مساحة الإعلانات: ${database.ads[adIndex].name}`);

  res.json(database.ads[adIndex]);
});

// Admin Users management
app.get('/api/admin/users', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  // Don't return passwords
  const usersSafe = database.users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt
  }));
  res.json(usersSafe);
});

app.put('/api/admin/users/:id/role', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  const database = JSONDatabase.get();
  const user = database.users.find(u => u.id === req.params.id);

  if (!user) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }

  user.role = role;
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'تعديل الصلاحيات', `تم تغيير رتبة المستخدم ${user.email} إلى ${role}`);

  res.json({ message: 'تم تغيير الصلاحيات بنجاح', role });
});

app.delete('/api/admin/users/:id', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const user = database.users.find(u => u.id === req.params.id);

  if (!user) {
    res.status(404).json({ message: 'المستخدم غير موجود' });
    return;
  }

  if (user.id === 'user_admin') {
    res.status(400).json({ message: 'لا يمكن حذف حساب الأدمن الرئيسي' });
    return;
  }

  database.users = database.users.filter(u => u.id !== req.params.id);
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'حظر مستخدم', `تم حظر وحذف المستخدم: ${user.email}`);

  res.json({ message: 'تم حظر وحذف المستخدم بنجاح' });
});

// Admin Reports
app.get('/api/admin/reports', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  res.json(database.reports);
});

app.put('/api/admin/reports/:id/resolve', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const report = database.reports.find(r => r.id === req.params.id);

  if (!report) {
    res.status(404).json({ message: 'البلاغ غير موجود' });
    return;
  }

  report.status = 'resolved';
  JSONDatabase.save(database);

  writeLog(req.user!.email, 'حل بلاغ', `تم وضع علامة "محلول" على البلاغ رقم ${report.id}`);

  res.json({ message: 'تم حل البلاغ بنجاح' });
});

// Admin System Logs
app.get('/api/admin/logs', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  res.json(database.logs);
});

// Admin Backup & Restore
app.post('/api/admin/backup', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const database = JSONDatabase.get();
  const backupData = JSON.stringify(database, null, 2);
  // Just return the backup as text so they can download or view it
  res.json({ backup: backupData, timestamp: new Date().toISOString() });
});

app.post('/api/admin/restore', authenticateToken, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { backup } = req.body;
  if (!backup) {
    res.status(400).json({ message: 'ملف النسخة الاحتياطية فارغ' });
    return;
  }

  try {
    const parsed = JSON.parse(backup);
    if (!parsed.users || !parsed.series || !parsed.chapters) {
      throw new Error('هيكل قاعدة البيانات المرفقة غير صالح');
    }

    JSONDatabase.save(parsed);
    writeLog(req.user!.email, 'استعادة نسخة احتياطية', 'تمت استعادة قاعدة البيانات بالكامل بنجاح من ملف خارجي');
    res.json({ message: 'تمت استعادة النسخة الاحتياطية بنجاح' });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'خطأ في قراءة ملف الاستعادة' });
  }
});


// --- BACKGROUND CRAWLER QUEUE & SYSTEM ---

interface JobItem {
  url: string;
  title: string;
  coverUrl?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

interface BackgroundJob {
  id: string;
  type: 'catalog_import' | 'catalog_extract';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  title: string;
  totalItems: number;
  completedItems: number;
  successCount: number;
  failedCount: number;
  logs: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  items: JobItem[];
  params: {
    autoChaptersCount: number;
    publishStatus: string;
  };
}

const backgroundJobs: BackgroundJob[] = [];
let isWorkerRunning = false;

async function performImportSingleInternal(
  url: string,
  initialTitleAr: string,
  autoChaptersCount: number,
  publishStatus: string,
  adminEmail: string,
  logCallback: (msg: string) => void
): Promise<{ success: boolean; seriesId?: string; titleAr?: string; titleEn?: string; chaptersAddedCount?: number; message: string }> {
  try {
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    logCallback(`⏳ بدء جلب تفاصيل العمل من الرابط: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Referer': origin
      }
    });
    clearTimeout(timeoutId);

    if (response.status === 403 || response.status === 503) {
      logCallback(`❌ تم حجب الطلب بواسطة حماية Cloudflare (الرمز: ${response.status})`);
      return {
        success: false,
        message: 'تم حجب الطلب بواسطة حماية Cloudflare للموقع المستهدف أثناء قراءة التفاصيل.'
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, ins').remove();

    // 1. Scrape Titles
    let titleAr = '';
    const titleSelectors = [
      '.series-title h1', '.manga-title h1', '.post-title h1', 
      '.entry-title', '.anime-title', '.manga-name',
      'h1.text-xl', 'h1.font-bold', 'h1', 'title'
    ];
    
    for (const sel of titleSelectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length > 2 && text !== 'Home' && text !== 'الرئيسية') {
        titleAr = text;
        break;
      }
    }
    
    if (titleAr) {
      titleAr = titleAr
        .replace(/\s*-\s*Olympus Scans.*/i, '')
        .replace(/\s*-\s*أوليمبوس.*/i, '')
        .replace(/\s*-\s*أزورا.*/i, '')
        .replace(/\s*-\s*Azora.*/i, '')
        .replace(/\s*-\s*Manga.*/i, '')
        .replace(/\s*-\s*مانجا.*/i, '')
        .trim();
    }
    
    if (!titleAr) {
      titleAr = initialTitleAr || 'عمل جديد مستورد';
    }

    logCallback(`📖 الاسم العربي للعمل المكتشف: "${titleAr}"`);

    let titleEn = '';
    const altTitleSelectors = [
      '.alternative-title', '.alternative', '.alt-title', 
      '.manga-title-en', '.manga-alt-title', '.post-title h2', 
      'h2.text-sm', 'h2.text-xs', 'h2.font-medium'
    ];
    
    for (const sel of altTitleSelectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length > 2 && /^[a-zA-Z0-9\s\-_:!?,.()'&]+$/.test(text)) {
        titleEn = text;
        break;
      }
    }
    
    if (!titleEn) {
      const slug = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
      titleEn = slug.replace(/[-_]/g, ' ').replace(/\b[a-z]/g, char => char.toUpperCase());
    }

    logCallback(`📖 الاسم الإنجليزي للعمل المكتشف: "${titleEn}"`);

    // 2. Scrape Cover
    let coverUrl = '';
    const metaOgImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('link[rel="image_src"]').attr('href');
    if (metaOgImage) {
      const src = metaOgImage.trim();
      if (src && !src.startsWith('data:image') && !src.includes('avatar') && !src.includes('logo') && !src.includes('banner') && !src.includes('placeholder')) {
        coverUrl = src;
      }
    }
    
    if (!coverUrl) {
      const coverSelectors = [
        '.summary_image img', '.manga-cover img', '.entry-header img', 
        'img.wp-post-image', '.tab-summary img', '.anime-cover img', 
        '.manga-poster img', '.series-cover img', '.series-poster img', 
        '.cover-img img', '.poster-img', '.series-header img', 
        '.series-info img', '.manga-info img'
      ];
      
      for (const sel of coverSelectors) {
        const imgEl = $(sel).first();
        if (imgEl.length > 0) {
          const src = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || imgEl.attr('data-cfsrc') || imgEl.attr('data-cdn-src') || '';
          if (src && !src.startsWith('data:image') && !src.includes('avatar') && !src.includes('logo') && !src.includes('banner') && !src.includes('placeholder')) {
            coverUrl = src.trim();
            break;
          }
        }
      }
    }
    
    if (!coverUrl) {
      coverUrl = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=600&q=80';
    }

    if (coverUrl.includes(' ')) {
      coverUrl = coverUrl.split(',')[0].trim().split(' ')[0].trim();
    }
    if (coverUrl.startsWith('//')) {
      coverUrl = `https:${coverUrl}`;
    } else if (coverUrl.startsWith('/')) {
      coverUrl = `${origin}${coverUrl}`;
    }

    logCallback(`🖼️ رابط الغلاف: ${coverUrl}`);

    // 3. Scrape Full Description with Paragraph Reconstitution
    const metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('meta[name="twitter:description"]').attr('content');
    let cleanMetaDesc = '';
    if (metaDesc) {
      const dText = cleanDescriptionText(metaDesc);
      if (dText.length > 20 && !isLikelyGarbageOrCode(dText)) {
        cleanMetaDesc = dText;
      }
    }

    let descriptionAr = '';
    const descSelectors = [
      '.manga-excerpt', '.summary-content', '.entry-content', 
      '.description-summary', '.manga-summary', '.post-content_item .post-content', 
      '.manga-description', '.manga-desc', '.series-description', 
      '.story-desc', '.series-synopsis', '.synopsis', '#synopsis', 
      '.description', '.excerpt', '.post-content', '.story',
      'div[itemprop="description"]', 'p.review-content'
    ];
    
    for (const sel of descSelectors) {
      const el = $(sel).first();
      if (el.length > 0) {
        const paragraphs: string[] = [];
        const pTags = el.find('p, span, div');
        if (pTags.length > 0) {
          pTags.each((_, p) => {
            const pText = $(p).text().trim();
            if (pText && pText.length > 5 && !isLikelyGarbageOrCode(pText)) {
              const cleanedText = cleanDescriptionText(pText);
              if (cleanedText && cleanedText.length > 5) {
                paragraphs.push(cleanedText);
              }
            }
          });
        }

        let combined = '';
        if (paragraphs.length > 0) {
          const uniqParas = Array.from(new Set(paragraphs));
          combined = uniqParas.join('\n\n');
        } else {
          combined = cleanDescriptionText(el.text());
        }

        if (combined && combined.length > 20 && !isLikelyGarbageOrCode(combined)) {
          descriptionAr = combined;
          break;
        }
      }
    }

    if (!descriptionAr && cleanMetaDesc) {
      descriptionAr = cleanMetaDesc;
    }

    if (!descriptionAr) {
      descriptionAr = `هذا العمل المتميز "${titleAr}" هو أحد أقوى أعمال المانجا والمانهوا المليئة بالإثارة والتشويق. نتمنى لكم قراءة ممتعة وشيقة لكافة الفصول على منصتنا!`;
    }

    // 4. Scrape Genres
    const genresSet = new Set<string>();
    const infoSelectors = [
      '.genres-content a', '.manga-genres a', '.genres a', '.series-genres a', 
      '.genre-item', '.manga-genre', 'a[href*="genre"]', 'a[href*="genres"]', 
      'a[href*="category"]', '.post-content_item:contains("Genre") a',
      '.post-content_item:contains("التصنيف") a', '.post-content_item:contains("تصنيف") a'
    ];
    
    $(infoSelectors.join(', ')).each((_, el) => {
      const genre = normalizeMangaGenre($(el).text());
      if (genre) genresSet.add(genre);
    });

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text() || '';
      if (href.includes('/genre/') || href.includes('/genres/') || href.includes('/tag/') || href.includes('/tags/') || href.includes('/manga-genre/') || href.includes('/series-genre/')) {
        const genreText = normalizeMangaGenre(text);
        if (genreText) genresSet.add(genreText);
        
        const match = href.match(/\/(?:genre|genres|tag|tags|manga-genre|series-genre)\/([^/]+)/i);
        if (match && match[1]) {
          const slug = match[1].replace(/-/g, ' ').replace(/_/g, ' ');
          const genreSlug = normalizeMangaGenre(slug);
          if (genreSlug) genresSet.add(genreSlug);
        }
      }
    });

    // Content Analysis Auto-detection Fallback
    const contentToAnalyze = `${titleAr} ${titleEn} ${descriptionAr}`.toLowerCase();
    if (contentToAnalyze.includes('نظام') || contentToAnalyze.includes('system') || contentToAnalyze.includes('النافذة السحرية')) genresSet.add('نظام');
    if (contentToAnalyze.includes('إعادة إحياء') || contentToAnalyze.includes('reincarnat') || contentToAnalyze.includes('تجسد')) genresSet.add('إعادة إحياء');
    if (contentToAnalyze.includes('زمني') || contentToAnalyze.includes('الزمن') || contentToAnalyze.includes('regress') || contentToAnalyze.includes('تراجع')) genresSet.add('زمني');
    if (contentToAnalyze.includes('سحر') || contentToAnalyze.includes('magic') || contentToAnalyze.includes('تعويذة')) genresSet.add('سحر');
    if (contentToAnalyze.includes('ألعاب') || contentToAnalyze.includes('game') || contentToAnalyze.includes('لعبة')) genresSet.add('ألعاب');
    if (contentToAnalyze.includes('أكشن') || contentToAnalyze.includes('action') || contentToAnalyze.includes('معركة')) genresSet.add('أكشن');
    if (contentToAnalyze.includes('فنون قتالية') || contentToAnalyze.includes('martial arts') || contentToAnalyze.includes('تنغ شو')) genresSet.add('فنون قتالية');
    if (contentToAnalyze.includes('رومانسية') || contentToAnalyze.includes('romance') || contentToAnalyze.includes('حب')) genresSet.add('رومانسية');
    if (contentToAnalyze.includes('شياطين') || contentToAnalyze.includes('demon') || contentToAnalyze.includes('شيطان')) genresSet.add('شياطين');
    if (contentToAnalyze.includes('رعب') || contentToAnalyze.includes('horror')) genresSet.add('رعب');
    if (contentToAnalyze.includes('نهاية العالم') || contentToAnalyze.includes('apocalypse')) genresSet.add('نهاية العالم');

    const genres = Array.from(genresSet);
    if (genres.length === 0) {
      genres.push('أكشن', 'خيال');
    }

    logCallback(`🏷️ التصنيفات المكتشفة (${genres.length}): ${genres.join(', ')}`);

    // 5. Scrape Authors
    let author = $('.author-content a, .manga-author, .author-name, .series-author').first().text().trim() || 'غير معروف';
    let artist = $('.artist-content a, .manga-artist, .artist-name, .series-artist').first().text().trim() || 'غير معروف';

    if (author === 'غير معروف') {
      const matchAuthor = $('.post-content_item:contains("Author") .summary-content').text().trim() || $('.post-content_item:contains("المؤلف") .summary-content').text().trim();
      if (matchAuthor) author = matchAuthor;
    }
    if (artist === 'غير معروف') {
      const matchArtist = $('.post-content_item:contains("Artist") .summary-content').text().trim() || $('.post-content_item:contains("الرسام") .summary-content').text().trim();
      if (matchArtist) artist = matchArtist;
    }

    let ageRating = '13+';
    if (genres.includes('سينين') || genres.includes('رعب') || genres.includes('نفسي') || contentToAnalyze.includes('18+') || contentToAnalyze.includes('mature')) {
      ageRating = '17+';
    }

    // ID / Slug
    const seriesId = titleEn
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^_+|_+$/g, '')
      .trim();

    const optimizedAlternativeTitles = [
      titleEn,
      titleAr,
      `قراءة مانجا ${titleAr} مترجمة`,
      `فصول مانهوا ${titleAr}`,
      `مانجا ${titleEn} مترجمة`,
      `مانهوا ${titleAr} كاملة`
    ].filter(Boolean).join(', ');

    const seoDescriptionAr = descriptionAr;
    const seoDescriptionEn = `Read the online chapters of Manga/Manhwa ${titleEn} in high definition. Stay tuned with daily automatic releases, latest updates of ${titleEn} translated into Arabic and English. Explore genres like: ${genres.join(', ')}.\n\n${titleEn} description:\nRead online ${titleEn} on our platform. High quality chapters updated automatically.`;

    const database = JSONDatabase.get();
    let seriesObj = database.series.find(s => s.id === seriesId);

    if (!seriesObj) {
      seriesObj = {
        id: seriesId,
        titleAr,
        titleEn,
        alternativeTitles: optimizedAlternativeTitles,
        descriptionAr: seoDescriptionAr,
        descriptionEn: seoDescriptionEn,
        coverUrl,
        bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&h=500&q=80',
        author,
        artist,
        status: 'ongoing',
        type: 'manhwa',
        ageRating,
        releaseYear: new Date().getFullYear().toString(),
        translator: 'فريق المترجمين المتميزين',
        rating: Number((4.5 + Math.random() * 0.5).toFixed(2)),
        views: Math.floor(1000 + Math.random() * 5000),
        likes: Math.floor(100 + Math.random() * 500),
        genres,
        addedAt: new Date().toISOString()
      };
      database.series.push(seriesObj);
      logCallback(`🎉 تم إنشاء العمل الجديد "${titleAr}" بنجاح في قاعدة البيانات.`);
    } else {
      seriesObj.titleAr = titleAr;
      seriesObj.titleEn = titleEn;
      seriesObj.alternativeTitles = optimizedAlternativeTitles;
      seriesObj.descriptionAr = seoDescriptionAr;
      seriesObj.descriptionEn = seoDescriptionEn;
      if (genres.length > 0) {
        seriesObj.genres = Array.from(new Set([...seriesObj.genres, ...genres]));
      }
      seriesObj.ageRating = ageRating;
      logCallback(`🔄 العمل "${titleAr}" موجود مسبقاً، تم تحديث بيانات العمل وتصنيفاته بنجاح.`);
    }

    JSONDatabase.save(database);

    // Scrape Chapters
    logCallback(`⏳ جاري البحث عن الفصول المتاحة في صفحة العمل...`);
    const scrapedChapters: { number: number; title: string; url: string }[] = [];
    const chapterSelectors = [
      '.wp-manga-chapter a', '.chapter-link a', 'li.sub-chap a', 
      '.chapters-list a', '.chapter-list a', '.list-group-item a', 
      'a.chapter-link', '.cl a', '.episode-list a', 
      '.chapters .chapter a', '.chapter-title a', '.chap-link a', 
      '.chapters-wrapper a', 'li.chapter-item a', 'li.wp-manga-chapter a',
      '.chapter_list_item a', '.chapter-grid a', '.epl_name a', 'a[href*="chapter"]'
    ];

    $(chapterSelectors.join(', ')).each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        const cleanHref = href.trim();
        if (
          cleanHref.startsWith('#') || 
          cleanHref.startsWith('javascript:') || 
          cleanHref.startsWith('mailto:') || 
          cleanHref.startsWith('tel:')
        ) {
          return;
        }
        const num = extractChapterNumber(text, cleanHref);
        if (num > 0) {
          try {
            let absoluteUrl = '';
            if (cleanHref.startsWith('//')) {
              absoluteUrl = `https:${cleanHref}`;
            } else if (cleanHref.startsWith('http://') || cleanHref.startsWith('https://')) {
              absoluteUrl = cleanHref;
            } else {
              absoluteUrl = new URL(cleanHref, url).href;
            }
            scrapedChapters.push({
              number: num,
              title: text || `الفصل ${num}`,
              url: absoluteUrl
            });
          } catch (e) {
          }
        }
      }
    });

    const uniqueChapters = scrapedChapters.reduce((acc, current) => {
      const exists = acc.find(item => item.number === current.number);
      if (!exists) acc.push(current);
      return acc;
    }, [] as typeof scrapedChapters);

    uniqueChapters.sort((a, b) => a.number - b.number);
    logCallback(`ℹ️ تم العثور على ${uniqueChapters.length} فصول متاحة للعمل.`);

    let chaptersAddedCount = 0;
    const chaptersToProcess = autoChaptersCount === -1 
      ? uniqueChapters 
      : (autoChaptersCount > 0 ? uniqueChapters.slice(-autoChaptersCount) : []);

    logCallback(`🚀 جاري معالجة وجلب صفحات ${chaptersToProcess.length} فصول مستهدفة...`);

    // 1. Filter out already existing chapters
    const currentDbBefore = JSONDatabase.get();
    const chaptersNeeded = chaptersToProcess.filter(chap => {
      const chapterId = `chapter_${seriesId}_${chap.number.toString().replace('.', '_')}`;
      return !currentDbBefore.chapters.some(c => c.id === chapterId);
    });

    const skippedCount = chaptersToProcess.length - chaptersNeeded.length;
    if (skippedCount > 0) {
      logCallback(`⏭️ تم تخطي ${skippedCount} فصول موجودة مسبقاً في الموقع.`);
    }

    logCallback(`⚡ جاري جلب وتحليل محتوى ${chaptersNeeded.length} فصول مستهدفة بالتوازي وبأقصى سرعة وقوة...`);

    // Fetch concurrently in batches of up to 6 in parallel
    const CONCURRENCY_LIMIT = 6;
    const results: { chap: any; cleanPages: string[] }[] = [];

    for (let i = 0; i < chaptersNeeded.length; i += CONCURRENCY_LIMIT) {
      const chunk = chaptersNeeded.slice(i, i + CONCURRENCY_LIMIT);
      
      await Promise.all(chunk.map(async (chap) => {
        logCallback(`⏳ جاري قراءة وتحليل صفحات الفصل رقم ${chap.number}...`);
        try {
          const chapController = new AbortController();
          const chapTimeoutId = setTimeout(() => chapController.abort(), 12000);
          const chapResponse = await fetch(chap.url, {
            signal: chapController.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Referer': url
            }
          });
          clearTimeout(chapTimeoutId);

          if (chapResponse.status === 200) {
            const chapHtml = await chapResponse.text();
            const chap$ = cheerio.load(chapHtml);
            chap$('script, style, noscript, iframe').remove();

            const pageUrls: string[] = [];
            const imageSelectors = [
              '.wp-manga-chapter-img', '.page-break img', '.chapter-content img', 
              '.chapter-images img', '.reader-area img', '.reader-image img', 
              '#readerarea img', '.read-container img', '.reading-content img',
              '.main-col img', '.entry-content img', '.post-content img',
              '#readerarea p img', '.images-container img', '#chapter-video-frame img'
            ];

            const attributes = [
              'src', 'data-src', 'data-lazy-src', 'data-cfsrc', 
              'data-cdn-src', 'data-original', 'data-src-img', 
              'data-urllist', 'data-srcset', 'srcset'
            ];

            chap$(imageSelectors.join(', ')).each((_, imgEl) => {
              let src = '';
              for (const attr of attributes) {
                const val = chap$(imgEl).attr(attr);
                if (val) {
                  let cleanVal = val.trim();
                  if (cleanVal.includes(' ')) {
                    cleanVal = cleanVal.split(',')[0].trim().split(' ')[0].trim();
                  }
                  if (
                    cleanVal && 
                    !cleanVal.startsWith('data:image') && 
                    !cleanVal.includes('avatar') && 
                    !cleanVal.includes('logo') && 
                    !cleanVal.includes('banner') && 
                    !cleanVal.includes('placeholder') &&
                    !cleanVal.includes('loader') &&
                    !cleanVal.includes('loading')
                  ) {
                    src = cleanVal;
                    break;
                  }
                }
              }
              if (src) pageUrls.push(src);
            });

            if (pageUrls.length === 0) {
              chap$('img').each((_, imgEl) => {
                let src = '';
                for (const attr of attributes) {
                  const val = chap$(imgEl).attr(attr);
                  if (val) {
                    let cleanVal = val.trim();
                    if (cleanVal.includes(' ')) {
                      cleanVal = cleanVal.split(',')[0].trim().split(' ')[0].trim();
                    }
                    if (
                      cleanVal && 
                      !cleanVal.startsWith('data:image') && 
                      !cleanVal.includes('avatar') && 
                      !cleanVal.includes('logo') && 
                      !cleanVal.includes('banner') && 
                      !cleanVal.includes('placeholder') &&
                      !cleanVal.includes('loader') &&
                      !cleanVal.includes('loading')
                    ) {
                      src = cleanVal;
                      break;
                    }
                  }
                }
                if (src) {
                  const lowerSrc = src.toLowerCase();
                  if (lowerSrc.includes('chapter') || lowerSrc.includes('page') || lowerSrc.includes('uploads/manga') || /\.(jpg|jpeg|png|webp)/i.test(lowerSrc)) {
                    pageUrls.push(src);
                  }
                }
              });
            }

            const cleanPages = Array.from(new Set(pageUrls))
              .filter(p => p.startsWith('http') || p.startsWith('//') || p.startsWith('/'))
              .map(p => {
                if (p.startsWith('//')) return `https:${p}`;
                if (p.startsWith('/')) return `${origin}${p}`;
                return p;
              });

            results.push({ chap, cleanPages });
          } else {
            logCallback(`❌ فشل جلب صفحات الفصل ${chap.number}: رمز الاستجابة ${chapResponse.status}`);
          }
        } catch (chapErr: any) {
          logCallback(`❌ خطأ أثناء معالجة الفصل ${chap.number}: ${chapErr.message || chapErr}`);
        }
      }));
    }

    // Sequentially save completed concurrent scrapings to prevent race conditions and DB corruption
    const currentDbAfter = JSONDatabase.get();
    for (const res of results) {
      if (res.cleanPages.length > 0) {
        const chapterId = `chapter_${seriesId}_${res.chap.number.toString().replace('.', '_')}`;
        
        if (!currentDbAfter.chapters.some(c => c.id === chapterId)) {
          const newChapter = {
            id: chapterId,
            seriesId,
            number: res.chap.number,
            titleAr: `الفصل ${res.chap.number}`,
            titleEn: `Chapter ${res.chap.number}`,
            pages: res.cleanPages,
            addedAt: new Date().toISOString(),
            isVisible: true,
            translatorName: 'فريق الترجمة التلقائي',
            status: publishStatus as 'draft' | 'published'
          };

          currentDbAfter.chapters.push(newChapter);
          chaptersAddedCount++;
          logCallback(`✅ تم حفظ الفصل ${res.chap.number} بنجاح مع جلب ${res.cleanPages.length} صفحة صورة.`);
        }
      } else {
        logCallback(`⚠️ الفصل ${res.chap.number} لا يحتوي على أي صور صالحة!`);
      }
    }

    if (chaptersAddedCount > 0) {
      JSONDatabase.save(currentDbAfter);
    }

    writeLog(adminEmail, 'استيراد تلقائي للكتالوج', `تم استيراد ${titleAr} بنجاح مع إضافة ${chaptersAddedCount} فصل بأعلى معايير SEO بالتوازي وبسرعة فائقة`);

    return {
      success: true,
      seriesId,
      titleAr,
      titleEn,
      chaptersAddedCount,
      message: `تم استيراد العمل "${titleAr}" بنجاح مع ${chaptersAddedCount} فصول متكاملة!`
    };

  } catch (error: any) {
    return {
      success: false,
      message: `فشل استيراد العمل: ${error.message}`
    };
  }
}

async function startBackgroundWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log('🤖 Background Crawler Worker started and listening for jobs...');
  
  while (true) {
    // Find the first job that is running, or pending
    const job = backgroundJobs.find(j => j.status === 'running' || j.status === 'pending');
    if (!job) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    if (job.status === 'pending') {
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      job.logs.push(`[${new Date().toLocaleTimeString()}] 🚀 تم تنشيط مهمة الخلفية وبدء معالجتها...`);
    }

    const nextItem = job.items.find(item => item.status === 'pending');
    if (nextItem) {
      if (job.status === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      if (job.status === 'stopped') {
        continue;
      }

      nextItem.status = 'running';
      job.logs.push(`[${new Date().toLocaleTimeString()}] ⏳ [${job.completedItems + 1}/${job.totalItems}] جاري معالجة: "${nextItem.title}"...`);
      
      try {
        const result = await performImportSingleInternal(
          nextItem.url,
          nextItem.title,
          job.params.autoChaptersCount,
          job.params.publishStatus,
          'system_queue@darkwatch.com',
          (msg) => {
            job.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
          }
        );

        if (result.success) {
          nextItem.status = 'completed';
          job.successCount++;
          job.logs.push(`[${new Date().toLocaleTimeString()}] ✅ تم استيراد "${nextItem.title}" بنجاح!`);
        } else {
          nextItem.status = 'failed';
          nextItem.error = result.message;
          job.failedCount++;
          job.logs.push(`[${new Date().toLocaleTimeString()}] ❌ فشل استيراد "${nextItem.title}": ${result.message}`);
        }
      } catch (err: any) {
        nextItem.status = 'failed';
        nextItem.error = err.message || 'خطأ مجهول';
        job.failedCount++;
        job.logs.push(`[${new Date().toLocaleTimeString()}] ❌ خطأ غير متوقع أثناء المعالجة: ${err.message}`);
      }

      job.completedItems++;
      
      // Delay to respect server rate limits (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500));
    } else {
      // All items processed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.logs.push(`[${new Date().toLocaleTimeString()}] 🎉 اكتملت المهمة بالكامل! نجاح: ${job.successCount}، فشل: ${job.failedCount}.`);
    }
  }
}

// Background Jobs API Endpoints
app.get('/api/admin/jobs', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  res.json(backgroundJobs);
});

app.post('/api/admin/jobs', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { title, items, params } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, message: 'قائمة الأعمال فارغة' });
    return;
  }

  const newJob: BackgroundJob = {
    id: `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'catalog_import',
    status: 'pending',
    title: title || 'استيراد كتالوج تلقائي',
    totalItems: items.length,
    completedItems: 0,
    successCount: 0,
    failedCount: 0,
    logs: [`[${new Date().toLocaleTimeString()}] 📋 تم إنشاء المهمة وجدولتها في طابور العمل بالخلفية.`],
    createdAt: new Date().toISOString(),
    items: items.map(item => ({
      url: item.url,
      title: item.title,
      coverUrl: item.coverUrl,
      status: 'pending'
    })),
    params: {
      autoChaptersCount: params?.autoChaptersCount ?? req.body.chaptersCount ?? req.body.autoChaptersCount ?? -1,
      publishStatus: params?.publishStatus ?? req.body.publishStatus ?? 'published'
    }
  };

  backgroundJobs.push(newJob);
  res.json({ success: true, jobId: newJob.id, message: 'تم جدولة المهمة بنجاح في الخلفية' });
});

app.get('/api/admin/jobs/:id', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const job = backgroundJobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    return;
  }
  res.json(job);
});

app.post('/api/admin/jobs/:id/pause', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const job = backgroundJobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    return;
  }
  if (job.status === 'running' || job.status === 'pending') {
    job.status = 'paused';
    job.logs.push(`[${new Date().toLocaleTimeString()}] ⏸️ تم إيقاف المهمة مؤقتاً بواسطة المشرف.`);
    res.json({ success: true, message: 'تم إيقاف المهمة مؤقتاً' });
  } else {
    res.status(400).json({ success: false, message: 'لا يمكن إيقاف مهمة ليست قيد التشغيل أو الانتظار' });
  }
});

app.post('/api/admin/jobs/:id/resume', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const job = backgroundJobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    return;
  }
  if (job.status === 'paused') {
    job.status = 'running';
    job.logs.push(`[${new Date().toLocaleTimeString()}] ▶️ تم استئناف تشغيل المهمة في الخلفية.`);
    res.json({ success: true, message: 'تم استئناف المهمة' });
  } else {
    res.status(400).json({ success: false, message: 'المهمة ليست موقوفة مؤقتاً' });
  }
});

app.post('/api/admin/jobs/:id/stop', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const job = backgroundJobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    return;
  }
  if (job.status === 'running' || job.status === 'paused' || job.status === 'pending') {
    job.status = 'stopped';
    job.completedAt = new Date().toISOString();
    job.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 تم إلغاء المهمة وإيقافها نهائياً بواسطة المشرف.`);
    res.json({ success: true, message: 'تم إلغاء المهمة وإيقافها' });
  } else {
    res.status(400).json({ success: false, message: 'المهمة مكتملة بالفعل أو ملغاة' });
  }
});

app.delete('/api/admin/jobs/:id', authenticateToken, requireRole(['admin', 'moderator']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const index = backgroundJobs.findIndex(j => j.id === id);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    return;
  }
  backgroundJobs.splice(index, 1);
  res.json({ success: true, message: 'تم حذف المهمة من السجل بنجاح' });
});


// Admin Catalog Extract Endpoint
app.post('/api/admin/catalog-extract', authenticateToken, requireRole(['admin', 'moderator']), async (req: AuthenticatedRequest, res: Response) => {
  const cleanUrl = (input: string): string => {
    if (!input) return '';
    let trimmed = input.trim();
    // Strip patterns like [1], [2], [10] etc. from the beginning
    trimmed = trimmed.replace(/^\[\d+\]\s*/, '');
    return trimmed.trim();
  };

  const url = cleanUrl(req.body.url);
  const secondPageUrl = cleanUrl(req.body.secondPageUrl);
  const { multiPage, pagesCount } = req.body;

  if (!url) {
    res.status(400).json({ success: false, message: 'يرجى إرسال رابط قائمة المانجا (الكتالوج)' });
    return;
  }

  const limitPages = multiPage ? Math.min(Math.max(Number(pagesCount) || 1, 1), 120) : 1;
  const items: { url: string; title: string; coverUrl: string }[] = [];
  const seenUrls = new Set<string>();

  function generatePageUrl(base: string, second: string | undefined, page: number): string {
    if (page === 1) return base;
    if (second && second.trim()) {
      const s = second.trim();
      const pageNumRegex = /(\b|_|-|\/|\?|&|=)(2)(\b|_|-|\/|\?|&|$)/;
      if (s.match(pageNumRegex)) {
        return s.replace(pageNumRegex, `$1${page}$3`);
      }
    }
    try {
      const parsed = new URL(base);
      if (parsed.searchParams.has('page')) {
        const u = new URL(base);
        u.searchParams.set('page', page.toString());
        return u.href;
      }
      if (parsed.search.match(/[?&]page=\d+/i)) {
        return base.replace(/([?&]page=)\d+/i, `$1${page}`);
      }
      if (parsed.pathname.match(/\/page\/\d+/i)) {
        return base.replace(/(\/page\/)\d+/i, `$1${page}`);
      }
      if (parsed.search) {
        return `${base}&page=${page}`;
      } else {
        const baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
        return `${baseClean}?page=${page}`;
      }
    } catch (e) {
      return base;
    }
  }

  try {
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    for (let p = 1; p <= limitPages; p++) {
      const targetPageUrl = generatePageUrl(url, secondPageUrl, p);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        
        const response = await fetch(targetPageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
            'Referer': origin
          }
        });
        clearTimeout(timeoutId);

        if (response.status === 403 || response.status === 503) {
          if (p === 1) {
            res.json({
              success: false,
              cloudflareBlocked: true,
              message: 'تم حجب الطلب بواسطة حماية Cloudflare للموقع المستهدف. يرجى محاولة استخدام قائمة روابط مباشرة بدلاً من ذلك.'
            });
            return;
          }
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove scripts, styles, etc.
        $('script, style, noscript, iframe, ins').remove();

        // Strategy 1: Find elements representing common manga listing grids/boxes
        const containerSelectors = [
          '.manga-item', '.wp-manga-flow-content', '.manga-box', '.item-summary', '.page-item-detail',
          '.entry', '.post', '.col-md-6', '.series-card', '.card', '.book-item', '.anime-card',
          '.manga-card', '.comic-card', '.list-manga-item', '.bs', '.bsx', '.uta', '.utao'
        ];

        containerSelectors.forEach(selector => {
          $(selector).each((_, el) => {
            const linkEl = $(el).find('a').first();
            const href = linkEl.attr('href');
            if (!href) return;

            let title = linkEl.text().trim();
            if (!title) {
              title = $(el).find('h3, h4, h2, .title, .entry-title, .tt').first().text().trim();
            }
            if (!title) {
              title = $(el).find('img').first().attr('alt') || '';
            }

            let coverUrl = '';
            const imgEl = $(el).find('img').first();
            if (imgEl.length > 0) {
              coverUrl = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || imgEl.attr('data-cfsrc') || '';
            }

            if (href && title) {
              let absoluteUrl = href;
              if (href.startsWith('//')) absoluteUrl = `https:${href}`;
              else if (href.startsWith('/')) absoluteUrl = `${origin}${href}`;

              // Filter out chapters, tags, pages, main search
              const isMangaLink = (absoluteUrl.includes('/manga/') || absoluteUrl.includes('/series/') || absoluteUrl.includes('/manhua/') || absoluteUrl.includes('/manhwa/') || absoluteUrl.includes('/comic/')) &&
                !absoluteUrl.includes('/chapter') && !absoluteUrl.includes('/chap') && !absoluteUrl.includes('/ch-') && !absoluteUrl.includes('/page/');

              if (isMangaLink && !seenUrls.has(absoluteUrl)) {
                seenUrls.add(absoluteUrl);
                
                if (coverUrl && coverUrl.startsWith('//')) coverUrl = `https:${coverUrl}`;
                else if (coverUrl && coverUrl.startsWith('/')) coverUrl = `${origin}${coverUrl}`;

                items.push({
                  url: absoluteUrl,
                  title: title.replace(/\s+/g, ' ').trim(),
                  coverUrl: coverUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=600&q=80'
                });
              }
            }
          });
        });

        // Strategy 2: Search all <a> tags with smart filters
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;

          let absoluteUrl = href;
          if (href.startsWith('//')) absoluteUrl = `https:${href}`;
          else if (href.startsWith('/')) absoluteUrl = `${origin}${href}`;

          const isMangaLink = (absoluteUrl.includes('/manga/') || absoluteUrl.includes('/series/') || absoluteUrl.includes('/manhua/') || absoluteUrl.includes('/manhwa/') || absoluteUrl.includes('/comic/')) &&
            !absoluteUrl.includes('/chapter') && !absoluteUrl.includes('/chap') && !absoluteUrl.includes('/ch-') && !absoluteUrl.includes('/page/');

          if (isMangaLink && !seenUrls.has(absoluteUrl)) {
            let title = $(el).text().trim();
            if (!title) {
              title = $(el).find('img').first().attr('alt') || '';
            }
            
            if (title && title.length > 2 && title !== 'Home' && title !== 'الرئيسية') {
              seenUrls.add(absoluteUrl);
              
              let coverUrl = '';
              const imgEl = $(el).find('img').first();
              if (imgEl.length > 0) {
                coverUrl = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || '';
              }

              if (coverUrl && coverUrl.startsWith('//')) coverUrl = `https:${coverUrl}`;
              else if (coverUrl && coverUrl.startsWith('/')) coverUrl = `${origin}${coverUrl}`;

              items.push({
                url: absoluteUrl,
                title: title.replace(/\s+/g, ' ').trim(),
                coverUrl: coverUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=600&q=80'
              });
            }
          }
        });

        if (p < limitPages) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      } catch (pageErr) {
        console.error(`Error crawling page ${p}:`, pageErr);
      }
    }

    res.json({
      success: true,
      itemsCount: items.length,
      items
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب كتالوج المانجا: ' + error.message });
  }
});


// Admin Single Catalog Item Importer Endpoint
app.post('/api/admin/catalog-import-single', authenticateToken, requireRole(['admin', 'moderator']), async (req: AuthenticatedRequest, res: Response) => {
  const { url, titleAr: initialTitleAr, autoChaptersCount = -1, publishStatus = 'published' } = req.body;

  if (!url) {
    res.status(400).json({ success: false, message: 'يرجى إرسال رابط العمل المستهدف' });
    return;
  }

  const result = await performImportSingleInternal(
    url,
    initialTitleAr,
    Number(autoChaptersCount),
    publishStatus,
    req.user!.email,
    (msg) => console.log(`[Import-Single] ${msg}`)
  );

  res.json(result);
});


// --- SEO AND SITEMAP GENERATOR ---
app.get('/sitemap.xml', (req, res) => {
  try {
    const database = JSONDatabase.get();
    const host = req.get('host') || 'darkmanhwa.com';
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const baseUrl = `${protocol}://${host}`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Main page
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Series details pages
    database.series.forEach(s => {
      xml += `  <url>\n    <loc>${baseUrl}/details/${s.id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    // Chapters reader pages
    database.chapters.forEach(c => {
      if (c.isVisible) {
        xml += `  <url>\n    <loc>${baseUrl}/reader/${c.id}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
      }
    });

    xml += `</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Error generating sitemap:', err);
    res.status(500).send('Error generating sitemap');
  }
});


// Serve static assets from public folder
app.use(express.static(path.join(process.cwd(), 'public')));

// --- CLIENT SIDE / VITE MIDDWARE INTEGRATION ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // In development mode, Vite handles page request and assets
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static dist directory with browser caching headers
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '7d', // Cache compiled assets for 7 days
      etag: true,
      lastModified: true
    }));
    app.get('*', (req, res) => {
      try {
        const indexFile = path.join(distPath, 'index.html');
        if (!fs.existsSync(indexFile)) {
          return res.sendFile(path.join(process.cwd(), 'index.html'));
        }

        let html = fs.readFileSync(indexFile, 'utf-8');
        const urlPath = req.path;
        const database = JSONDatabase.get();

        let seoTitle = database.settings?.siteName || 'Dark Manhwa';
        let seoDesc = database.settings?.description || 'منصة قراءة المانجا والمانهوا العربية الاحترافية الأولى - جودة خارقة وسرعة فائقة';
        let seoImage = '/logo.png'; // default logo/cover
        let seoKeywords = 'مانجا, مانهوا, قراءة مانجا, مترجم, فصول, مانجا عربية, مانجا اون لاين, مانهوا اون لاين';

        if (urlPath.startsWith('/details/')) {
          const seriesId = urlPath.replace('/details/', '').split('?')[0];
          const series = database.series.find(s => s.id === seriesId);
          if (series) {
            seoTitle = `${series.titleAr} (${series.titleEn}) - ${seoTitle}`;
            seoDesc = series.descriptionAr || series.descriptionEn || seoDesc;
            if (series.coverUrl) {
              seoImage = series.coverUrl;
            }
            if (series.genres && series.genres.length > 0) {
              seoKeywords = `${series.genres.join(', ')}, ${seoKeywords}`;
            }
          }
        } else if (urlPath.startsWith('/reader/')) {
          const chapterId = urlPath.replace('/reader/', '').split('?')[0];
          const chapter = database.chapters.find(c => c.id === chapterId);
          if (chapter) {
            const series = database.series.find(s => s.id === chapter.seriesId);
            if (series) {
              seoTitle = `قراءة ${chapter.titleAr || `الفصل ${chapter.number}`} من ${series.titleAr} - ${seoTitle}`;
              seoDesc = `اقرأ ${chapter.titleAr || `الفصل ${chapter.number}`} من ${series.titleAr} اون لاين بجودة عالية وبدون إعلانات مزعجة. مترجم للعربية.`;
              if (series.coverUrl) {
                seoImage = series.coverUrl;
              }
            }
          }
        }

        // Clean values from double quotes to avoid breaking HTML attributes
        const cleanTitle = seoTitle.replace(/"/g, '&quot;');
        const cleanDesc = seoDesc.replace(/"/g, '&quot;');
        const cleanKeywords = seoKeywords.replace(/"/g, '&quot;');

        const seoMetaTags = `
    <title>${cleanTitle}</title>
    <meta name="description" content="${cleanDesc}" />
    <meta name="keywords" content="${cleanKeywords}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${cleanTitle}" />
    <meta property="og:description" content="${cleanDesc}" />
    <meta property="og:image" content="${seoImage}" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${cleanTitle}" />
    <meta property="twitter:description" content="${cleanDesc}" />
    <meta property="twitter:image" content="${seoImage}" />
    
    <!-- Dynamic Sitemap and Robots -->
    <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
    <meta name="robots" content="index, follow" />
  `;

        // Inject inside HTML
        if (html.includes('<title>')) {
          html = html.replace(/<title>[^]*?<\/title>/, seoMetaTags);
        } else {
          html = html.replace('</head>', `${seoMetaTags}\n</head>`);
        }

        res.send(html);
      } catch (err) {
        console.error('Error in HTML SEO injector:', err);
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  // Start the background jobs worker queue
  startBackgroundWorker().catch(err => {
    console.error('Failed to start background jobs worker:', err);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dark Manhwa Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
