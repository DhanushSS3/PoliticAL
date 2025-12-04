import dotenv from 'dotenv';

// Only load .env file when running locally (not in production/Render)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './.env' });
}

// Also merge variables from config.env in all environments so production/test get keys
// Do not override already-set platform env vars
dotenv.config({ path: './config.env', override: false });


import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import hpp from 'hpp';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
// Inline routing: controllers and auth middleware
import * as courseController from './controllers/courseController.js';
import * as jobController from './controllers/jobController.js';
import * as articleController from './controllers/articleController.js';
import * as reviewController from './controllers/reviewController.js';
import * as queryController from './controllers/queryController.js';
import * as adminController from './controllers/adminController.js';
import { protect, restrictTo } from './middleware/auth.js';
import * as awardController from './controllers/awardController.js';
import * as bookingController from './controllers/bookingController.js';
import * as authController from './controllers/authController.js';
import * as aiController from './controllers/aiController.js';
import * as questionController from './controllers/questionController.js';
import * as championController from './controllers/championController.js';
import * as mentorController from './controllers/mentorController.js';
import * as brandController from './controllers/brandController.js';
import * as materialController from './controllers/materialController.js';
import * as assessmentController from './controllers/assessmentController.js';
import * as groupController from './controllers/groupController.js';
import * as groupMessageController from './controllers/groupMessageController.js';
import * as premiumMeetingController from './controllers/premiumMeetingController.js';
import { Server as SocketIOServer } from 'socket.io';
import Article from './models/Article.js';
import * as resumeController from './controllers/resumeController.js';
import * as callController from './controllers/callController.js';
import {
  uploadUserPhoto,
  resizeUserPhoto,
  getUser,
  getMyEnrolledCourses,
  getMyReviews,
  getMyBookings,
  getAllUsers as getAllUsersController,
  updateUser as updateUserController,
  deleteUser as deleteUserController,
  getUserStats,
} from './controllers/userController.js';

// dotenv already loaded above via import 'dotenv/config'

// Import cleanup function
import cleanupUnverifiedAccounts from './utils/cleanupUnverifiedAccounts.js';

// Initialize cleanup of unverified accounts
cleanupUnverifiedAccounts();

// Configure AI model centrally (do not rely on env for model name)
try {
  setAIModelName('gemini-2.5-flash-lite');
} catch (e) {
  console.warn('AI model setter unavailable, continuing with default model.');
}

// Import models
import User from './models/User.js';
import Review from './models/Review.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

// Function to ensure admin user exists
const ensureAdminUser = async () => {
  try {
    const adminEmail = 'shannu@admin.com';
    const adminPassword = '667700';
    
    // Check if admin already exists
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (!adminExists) {
      // Create admin user
      const admin = await User.create({
        name: 'Admin User',
        email: adminEmail,
        password: adminPassword,
        passwordConfirm: adminPassword,
        role: 'admin',
        isVerified: true,
        phone: '+1234567890',
        active: true
      });
      
      console.log('✅ Admin user created successfully');
    } else {
      // Ensure admin has correct permissions
      await User.updateOne(
        { email: adminEmail },
        {
          $set: {
            role: 'admin',
            isVerified: true,
            active: true
          }
        }
      );
      console.log('✅ Admin user verified');
    }
  } catch (error) {
    console.error('❌ Error ensuring admin user:', error.message);
  }
};

// Ensure Review indexes: drop legacy unique index that doesn't handle course: null and sync model indexes
const ensureReviewIndexes = async () => {
  try {
    const collection = mongoose.connection.collection('reviews');
    const indexes = await collection.indexes();
    const dupIndex = indexes.find((idx) => idx.name === 'user_1_course_1');
    if (dupIndex) {
      // Drop legacy index; model defines a partial unique index instead
      await collection.dropIndex('user_1_course_1');
      console.log('🔧 Dropped legacy reviews index user_1_course_1');
    }
    // Sync model-defined indexes (creates partial unique index)
    await Review.syncIndexes();
    console.log('✅ Review indexes synchronized');
  } catch (err) {
    console.error('❌ Error ensuring review indexes:', err.message);
  }
};

// Ensure Article indexes: drop legacy slug_1 if present and sync model indexes
const ensureArticleIndexes = async () => {
  try {
    const collection = mongoose.connection.collection('articles');
    const indexes = await collection.indexes();
    const slugIdx = indexes.find((idx) => idx.name === 'slug_1');
    // If legacy unique index on slug exists (often created without sparse), keep it but ensure model indexes match
    // If needed, drop and let Mongoose recreate based on schema
    if (slugIdx && !slugIdx.sparse) {
      await collection.dropIndex('slug_1');
      console.log('🔧 Dropped legacy articles index slug_1');
    }
    await Article.syncIndexes();
    console.log('✅ Article indexes synchronized');
  } catch (err) {
    console.error('❌ Error ensuring article indexes:', err.message);
  }
};

// Removed router mounts; endpoints are inlined below

// Import Vite for development
import { createServer as createViteServer } from 'vite';

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Initialize express
const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Behind a proxy (e.g., Render/Onrender) enable trust proxy so secure cookies work
app.set('trust proxy', 1);

// Set security HTTP headers with Vite HMR compatibility
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP as it can interfere with Vite's HMR
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // Allow postMessage across origins in dev (needed for Google Identity Services)
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parser, reading data from body into req.body
// Increased limit to support large HTML pastes from admin Optional page
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native',
    crypto: {
      secret: process.env.SESSION_ENCRYPTION_KEY || 'your-encryption-key'
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    sameSite: 'lax',
    path: '/'
  },
  name: 'sessionId'
};

// CORS configuration
const allowedOrigins = [
  // Local development
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  
  // Production domains
  /^https?:\/\/([a-z0-9-]+\.)*career-redefine\.com$/, 
  // New primary domain (Hostinger): allow both www and non-www
  /^https?:\/\/([a-z0-9-]+\.)*careerredefine\.com$/,

  // Testing subdomain(s)
  /^https?:\/\/([a-z0-9-]+\.)*testing\.careerredefine\.com$/,


  // Test subdomain (and nested) - allow both http/https (for local proxy testing) and www
  /^https?:\/\/([a-z0-9-]+\.)*test\.careerredefine\.com$/,
  /^https?:\/\/([a-z0-9-]+\.)*career-redefine\.vercel\.app$/,
  /^https?:\/\/([a-z0-9-]+\.)*career-redefine\.onrender\.com$/,
  
  // Specific production URLs
  'https://test.testing.testing.careerredefine.com',
  'https://www.test.testing.testing.careerredefine.com',

  'https://testing.testing.careerredefine.com',
  'https://www.test5-x7xt.onrender.com',

  // Second testing domain
  'https://testing.testing.careerredefine.com',

  'https://test.career-redefine.vercel.app',
  'https://test.career-redefine.com'
];

// Add FRONTEND_URL if provided
if (process.env.FRONTEND_URL) {
  if (Array.isArray(process.env.FRONTEND_URL)) {
    allowedOrigins.push(...process.env.FRONTEND_URL);
  } else {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
}

const allowAllOrigins = String(process.env.CORS_ALLOW_ALL || '').toLowerCase() === 'true';

const corsOptions = {
  origin(origin, callback) {
    // Allow all origins explicitly when testing is enabled
    if (allowAllOrigins) return callback(null, true);
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      }
      // Handle regex patterns
      return pattern.test(origin);
    });
    
    if (process.env.NODE_ENV === 'development' || isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'X-Access-Token',
    'X-Refresh-Token'
  ],
  credentials: true,
  exposedHeaders: [
    'set-cookie', 
    'Authorization',
    'X-Access-Token',
    'X-Refresh-Token'
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS with options
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Session middleware must come before routes but after CORS
app.use(session(sessionConfig));

// Handle preflight requests (already enabled above)

// Rate limiting (relaxed in development)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 100 : 0, // 0 means disabled when skip isn't used
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?.id ?? ipKeyGenerator(req, res),
  skip: () => process.env.NODE_ENV !== 'production'
});
app.use('/api', limiter);

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'duration',
    'ratingsQuantity',
    'ratingsAverage',
    'maxGroupSize',
    'difficulty',
    'price'
  ]
}));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// API Routes - Inline under /api/v1

// ----- Auth -----
app.post('/api/v1/auth/signup', authController.signup);
app.post('/api/v1/auth/send-otp', authController.sendOTP);
app.post('/api/v1/auth/verify-otp', authController.verifyOTP);
app.post('/api/v1/auth/resend-otp', authController.resendOTP);
app.post('/api/v1/auth/login', authController.login);
app.post('/api/v1/auth/google-auth', authController.googleAuth);
app.post('/api/v1/auth/forgot-password', authController.forgotPassword);
app.patch('/api/v1/auth/reset-password/:token', authController.resetPassword);
// OTP-based password reset
app.post('/api/v1/auth/forgot-password-otp', authController.forgotPasswordOTP);
app.post('/api/v1/auth/reset-password-otp', authController.resetPasswordByOTP);
app.post('/api/v1/auth/refresh-token', authController.refreshToken);
app.post('/api/v1/auth/logout', authController.logout);
// Protected auth routes
app.get('/api/v1/auth/me', protect, authController.getMe);
app.patch('/api/v1/auth/update-me', protect, uploadUserPhoto, resizeUserPhoto, authController.updateMe);
app.delete('/api/v1/auth/delete-me', protect, authController.deleteMe);
app.patch('/api/v1/auth/update-password', protect, authController.updatePassword);
// Compatibility GET logout
app.get('/api/v1/auth/logout', authController.logout);

// ----- Courses -----
app.get('/api/v1/courses', courseController.getAllCourses);
app.get('/api/v1/courses/search', courseController.searchCourses);
app.get('/api/v1/courses/popular', courseController.getPopularCourses);
app.get('/api/v1/courses/:id', courseController.getCourse);
app.post(
  '/api/v1/courses',
  protect,
  restrictTo('instructor', 'admin'),
  courseController.uploadCourseAssets,
  courseController.resizeCourseImage,
  courseController.processSyllabus,
  courseController.createCourse
);
app.patch(
  '/api/v1/courses/:id',
  protect,
  restrictTo('instructor', 'admin'),
  courseController.uploadCourseAssets,
  courseController.resizeCourseImage,
  courseController.processSyllabus,
  courseController.updateCourse
);
app.delete(
  '/api/v1/courses/:id',
  protect,
  restrictTo('instructor', 'admin'),
  courseController.deleteCourse
);
app.get('/get-api-key', (req, res) => {
  res.json({ apiKey: process.env.JOOBLE_KEY });
});
// External: Naukri jobs via n8n webhook proxy
app.get('/api/v1/external/naukri', async (req, res) => {
  try {
    const base = process.env.NAUKRI_N8N_URL;
    // If no external URL configured, fall back to local mock endpoint
    const fallbackBase = `${req.protocol}://${req.get('host')}/webhook/naukri-jobs`;
    const url = new URL(base || fallbackBase);
    const { keywords, location, page, limit } = req.query || {};
    if (keywords) url.searchParams.set('keywords', String(keywords));
    if (location) url.searchParams.set('location', String(location));
    if (page) url.searchParams.set('page', String(page));
    if (limit) url.searchParams.set('limit', String(limit));

    const resp = await fetch(url.toString(), { method: 'GET' });
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      return res.status(resp.status).json({ status: 'error', message: `Upstream error ${resp.status}` });
    }
    // Pass through JSON responses as-is
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      return res.json(data);
    }
    // Fallback: text
    const text = await resp.text();
    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch {
      return res.json({ jobs: [], raw: text });
    }
  } catch (e) {
    console.error('Naukri proxy error:', e);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch Naukri jobs' });
  }
});
// Direct fallback/mock Naukri jobs endpoint for local development without n8n
app.get('/webhook/naukri-jobs', (req, res) => {
  try {
    const { keywords = 'developer OR engineer', location = 'India', page = '1', limit = '10' } = req.query || {};
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 50);

    const roles = [
      // Engineering (software)
      'Software Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full Stack Engineer',
      'React Developer',
      'Node.js Developer',
      'Data Engineer',
      'DevOps Engineer',
      'QA Engineer',
      'Android Developer',
      // Engineering (core)
      'Civil Engineer',
      'Site Engineer',
      'Mechanical Engineer',
      'Electrical Engineer',
      'Project Engineer',
      // Business & Ops
      'Project Manager',
      'Operations Manager',
      'Business Analyst',
      'Product Manager',
      // Finance & Accounts
      'Accountant',
      'Accounts Executive',
      'Finance Executive',
      // Support & Admin
      'Customer Support Executive',
      'Data Entry Operator',
      'Office Administrator',
      // Sales & Marketing
      'Sales Executive',
      'Marketing Executive',
      'Digital Marketing Specialist',
      // Creative
      'Graphic Designer',
      'Content Writer',
      'Video Editor',
      // HR
      'HR Executive',
      'Recruiter'
    ];

    const companies = [
      'TechNova', 'InnoSoft', 'ByteWorks', 'CloudForge', 'DataPulse',
      'Quantum Apps', 'BlueStack', 'NextGen Labs', 'PixelCraft', 'CodeSphere'
    ];

    const now = new Date();
    const items = [];
    const startIdx = (pageNum - 1) * limitNum;

    const kw = String(keywords).trim().toLowerCase();
    const tokens = kw
      .replace(/\bor\b|\band\b/gi, ' ')
      .split(/[^a-z0-9+#.]+/i)
      .filter(Boolean);

    // Build a candidate pool larger than the requested page to allow filtering
    const poolSize = limitNum * 5;
    const pool = [];
    for (let i = 0; i < poolSize; i++) {
      const role = roles[(startIdx + i) % roles.length];
      const company = companies[(startIdx + i) % companies.length];
      pool.push({ role, company });
    }

    // Filter by keywords; if nothing matches, fall back to full pool so we always return items
    let filtered = pool;
    if (kw.length > 0) {
      const byPhrase = pool.filter(({ role }) => role.toLowerCase().includes(kw));
      const byTokens = pool.filter(({ role, company }) => {
        const hay = `${role} ${company}`.toLowerCase();
        return tokens.every(t => hay.includes(t));
      });
      filtered = byPhrase.length > 0 ? byPhrase : (byTokens.length > 0 ? byTokens : pool);
    }

    // Finalize items for the current page
    for (let i = 0; i < Math.min(limitNum, filtered.length); i++) {
      const { role, company } = filtered[i];
      const title = `${role} · ${String(keywords)}`;
      const jobLocation = /india/i.test(String(location)) ? String(location) : `${String(location)}, India`;
      const linkQuery = encodeURIComponent(`${role} ${String(keywords)} ${jobLocation}`);
      items.push({
        id: `naukri_${pageNum}_${i}`,
        title,
        company,
        location: jobLocation,
        snippet: `Join ${company} as a ${role}. Keywords: ${String(keywords)}. Location: ${jobLocation}.`,
        link: `https://www.naukri.com/${role.toLowerCase().replace(/\s+/g, '-')}-jobs?query=${linkQuery}`,
        salary: 'Not disclosed',
        updated: now.toISOString(),
        type: 'Full-time'
      });
    }

    return res.json({ jobs: items, page: pageNum, limit: limitNum });
  } catch (e) {
    console.error('Local Naukri mock error:', e);
    return res.status(500).json({ status: 'error', message: 'Failed to generate mock Naukri jobs' });
  }
});
// ----- Jobs -----
app.get('/api/v1/jobs', jobController.getAllJobs);
app.get('/api/v1/jobs/featured', jobController.getFeaturedJobs);
app.get('/api/v1/jobs/employer/:employerId', jobController.getJobsByEmployer);
app.get('/api/v1/jobs/:id', jobController.getJob);
app.post(
  '/api/v1/jobs',
  protect,
  restrictTo('employer', 'admin'),
  jobController.uploadJobLogo,
  jobController.resizeJobLogo,
  jobController.createJob
);
app.patch(
  '/api/v1/jobs/:id',
  protect,
  restrictTo('employer', 'admin'),
  jobController.uploadJobLogo,
  jobController.resizeJobLogo,
  jobController.updateJob
);
app.delete(
  '/api/v1/jobs/:id',
  protect,
  restrictTo('employer', 'admin'),
  jobController.deleteJob
);

// ----- Articles -----
app.get('/api/v1/articles', articleController.getAllArticles);
app.get('/api/v1/articles/featured', articleController.getFeaturedArticles);
app.get('/api/v1/articles/tag/:tag', articleController.getArticlesByTag);
app.get('/api/v1/articles/search', articleController.searchArticles);
app.get('/api/v1/articles/:id', articleController.getArticle);
app.post(
  '/api/v1/articles',
  protect,
  restrictTo('author', 'admin'),
  articleController.uploadArticleImage,
  articleController.resizeArticleImage,
  articleController.createArticle
);
app.patch(
  '/api/v1/articles/:id',
  protect,
  restrictTo('author', 'admin'),
  articleController.uploadArticleImage,
  articleController.resizeArticleImage,
  articleController.updateArticle
);
app.delete(
  '/api/v1/articles/:id',
  protect,
  restrictTo('author', 'admin'),
  articleController.deleteArticle
);

// ----- Reviews -----
app.get('/api/v1/reviews', reviewController.getAllReviews);
app.get('/api/v1/reviews/course/:courseId', reviewController.getCourseReviews);
app.get('/api/v1/reviews/user/:userId', reviewController.getUserReviews);
app.get('/api/v1/reviews/:id', reviewController.getReview);
app.post(
  '/api/v1/reviews',
  protect,
  reviewController.uploadReviewImages,
  reviewController.processReviewImages,
  reviewController.createReview
);
app.patch(
  '/api/v1/reviews/:id',
  protect,
  reviewController.uploadReviewImages,
  reviewController.processReviewImages,
  reviewController.updateReview
);
app.delete('/api/v1/reviews/:id', protect, reviewController.deleteReview);
// Admin-only list all
app.get('/api/v1/reviews/admin/all', protect, restrictTo('admin'), reviewController.getAllReviews);

// Test database connection and collections
app.get('/api/v1/test/db', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Check if required collections exist
    const requiredCollections = ['users', 'bookings', 'courses', 'jobs', 'articles', 'queries', 'questions', 'reviews'];
    const missingCollections = requiredCollections.filter(c => !collectionNames.includes(c));
    
    // Test queries collection
    let queriesTest = { success: false };
    try {
      const testQuery = await mongoose.connection.db.collection('queries').findOne({});
      queriesTest = { 
        success: true, 
        count: await mongoose.connection.db.collection('queries').countDocuments() 
      };
    } catch (e) {
      queriesTest = { success: false, error: e.message };
    }
    
    // Test bookings collection
    let bookingsTest = { success: false };
    try {
      const testBooking = await mongoose.connection.db.collection('bookings').findOne({});
      bookingsTest = { 
        success: true, 
        count: await mongoose.connection.db.collection('bookings').countDocuments() 
      };
    } catch (e) {
      bookingsTest = { success: false, error: e.message };
    }
    
    res.status(200).json({
      status: 'success',
      connected: mongoose.connection.readyState === 1,
      collections: collectionNames,
      missingCollections: missingCollections,
      tests: {
        queries: queriesTest,
        bookings: bookingsTest
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Public: generic enquiry used by static HTML pages for queries (e.g., 'Request a Call Back')
app.post('/api/enquiry', (req, res, next) => {
  try {
    const { name, email, phone, message, qualification, subject, page, form_type } = req.body || {};
    // Build a sensible subject if missing
    const derivedSubject = subject || `${page || 'General'} ${form_type === 'interview' ? 'Interview ' : ''}Enquiry`.trim();
    // If no message provided, compose one including qualification
    const composedMessage = message || `User enquiry submitted.${qualification ? ` Qualification: ${qualification}.` : ''}`;

    // Normalize body to what queryController expects
    req.body = {
      name,
      email,
      phone,
      subject: derivedSubject,
      message: composedMessage,
    };

    return queryController.createQuery(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});

// Mirror path for the above enquiry form, without the /api prefix, for proxy compatibility.
app.post('/enquiry', (req, res, next) => {
  try {
    const { name, email, phone, message, qualification, subject, page, form_type } = req.body || {};
    const derivedSubject = subject || `${page || 'General'} ${form_type === 'interview' ? 'Interview ' : ''}Enquiry`.trim();
    const composedMessage = message || `User enquiry submitted.${qualification ? ` Qualification: ${qualification}.` : ''}`;
    req.body = { name, email, phone, subject: derivedSubject, message: composedMessage };
    return queryController.createQuery(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});

// Public: interview booking used by static HTML pages for appointments (e.g., 'Book a Free Live Class')
app.post('/api/book-interview', (req, res, next) => {
  try {
    const { name, email, phone, message, interview_date, interview_time, date, time, timeSlot } = req.body || {};

    // Allow both interview_* fields and generic date/time inputs
    const normalizedDate = interview_date || date;
    const normalizedTime = interview_time || time || timeSlot;

    // Normalize body to what bookingController expects
    req.body = {
      name,
      email,
      phone,
      message,
      date: normalizedDate,
      timeSlot: normalizedTime,
      type: 'consultation'
    };

    return bookingController.createBooking(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});


// Mirror path for the above interview booking form, without the /api prefix, for proxy compatibility.
app.post('/book-interview', (req, res, next) => {
  try {
    const { name, email, phone, message, interview_date, interview_time, date, time, timeSlot } = req.body || {};
    const normalizedDate = interview_date || date;
    const normalizedTime = interview_time || time || timeSlot;
    req.body = { name, email, phone, message, date: normalizedDate, timeSlot: normalizedTime, type: 'consultation' };
    return bookingController.createBooking(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});

// ----- Legacy/static page aliases -----
// Some static course pages post to /api/interview or /interview or camelCase variants
app.post('/api/interview', (req, res, next) => {
  try {
    const { name, email, phone, message, interview_date, interview_time, date, time, timeSlot } = req.body || {};
    const normalizedDate = interview_date || date;
    const normalizedTime = interview_time || time || timeSlot;
    req.body = { name, email, phone, message, date: normalizedDate, timeSlot: normalizedTime, type: 'consultation' };
    return bookingController.createBooking(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});
app.post('/interview', (req, res, next) => {
  try {
    const { name, email, phone, message, interview_date, interview_time, date, time, timeSlot } = req.body || {};
    const normalizedDate = interview_date || date;
    const normalizedTime = interview_time || time || timeSlot;
    req.body = { name, email, phone, message, date: normalizedDate, timeSlot: normalizedTime, type: 'consultation' };
    return bookingController.createBooking(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});
app.post('/api/bookInterview', (req, res, next) => {
  try {
    const { name, email, phone, message, interview_date, interview_time, date, time, timeSlot } = req.body || {};
    const normalizedDate = interview_date || date;
    const normalizedTime = interview_time || time || timeSlot;
    req.body = { name, email, phone, message, date: normalizedDate, timeSlot: normalizedTime, type: 'consultation' };
    return bookingController.createBooking(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});
app.post('/bookInterview', (req, res, next) => {
  try {
    const { name, email, phone, message, interview_date, interview_time, date, time, timeSlot } = req.body || {};
    const normalizedDate = interview_date || date;
    const normalizedTime = interview_time || time || timeSlot;
    req.body = { name, email, phone, message, date: normalizedDate, timeSlot: normalizedTime, type: 'consultation' };
    return bookingController.createBooking(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});

// Enquiry forms on static pages often post to /api/enquiry or /enquiry
app.post('/api/enquiry', (req, res, next) => {
  try {
    // Normalize common field names coming from static forms
    const { name, email, phone, subject, message, course } = req.body || {};
    req.body = { name, email, phone, subject: subject || 'Course Enquiry', message, course };
    return queryController.createQuery(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});
app.post('/enquiry', (req, res, next) => {
  try {
    const { name, email, phone, subject, message, course } = req.body || {};
    req.body = { name, email, phone, subject: subject || 'Course Enquiry', message, course };
    return queryController.createQuery(req, res, next);
  } catch (e) {
    return res.status(400).json({ status: 'fail', message: e.message });
  }
});


// ----- Queries -----
// Public submit
app.post('/api/v1/queries', queryController.createQuery);
// User protected
app.get('/api/v1/queries/my-queries', protect, queryController.getMyQueries);
app.get('/api/v1/queries/:id', protect, queryController.getQuery);
// Admin
app.get('/api/v1/queries', protect, restrictTo('admin'), queryController.getAllQueries); // Corrected route for admin
app.get('/api/v1/queries/admin/all', protect, restrictTo('admin'), queryController.getAllQueries);
app.get('/api/v1/queries/stats/query-stats', protect, restrictTo('admin'), queryController.getQueryStats);
app.patch('/api/v1/queries/:id/status', protect, restrictTo('admin'), queryController.updateQueryStatus);
app.post('/api/v1/queries/:id/reply', protect, restrictTo('admin'), queryController.replyToQuery);
// Admin: hard delete a query
app.delete('/api/v1/queries/:id', protect, restrictTo('admin'), queryController.deleteQuery);


// ----- Questions -----
// Public submit
app.post('/api/v1/questions', questionController.createQuestion);
// Admin
app.get('/api/v1/questions', protect, restrictTo('admin'), questionController.getAllQuestions);
app.get('/api/v1/questions/:id', protect, restrictTo('admin'), questionController.getQuestion);
app.delete('/api/v1/questions/:id', protect, restrictTo('admin'), questionController.deleteQuestion);

// ----- Callback Requests -----
// Public submit
app.post('/api/v1/callbacks', callController.createCallbackRequest);
// Admin list and delete (used by admin UI)
app.get('/api/v1/callbacks', protect, restrictTo('admin'), callController.getCallbackRequests);
app.delete('/api/v1/callbacks/:id', protect, restrictTo('admin'), callController.deleteCallbackRequest);

// ----- Admin (Users + Dashboard) -----
app.get('/api/v1/admin/dashboard/stats', protect, restrictTo('admin'), adminController.getDashboardStats);
app.get('/api/v1/admin/users', protect, restrictTo('admin'), adminController.getAllUsers);
app.get('/api/v1/admin/users/:id', protect, restrictTo('admin'), adminController.getUser);
app.patch('/api/v1/admin/users/:id', protect, restrictTo('admin'), adminController.updateUser);
app.delete('/api/v1/admin/users/:id', protect, restrictTo('admin'), adminController.deleteUser);
app.patch('/api/v1/admin/users/bulk-update', protect, restrictTo('admin'), adminController.bulkUpdateUsers);
app.delete('/api/v1/admin/users/bulk-delete', protect, restrictTo('admin'), adminController.bulkDeleteUsers);

// ----- Admin Premium Users -----
app.get('/api/v1/admin/premium-users', protect, restrictTo('admin'), adminController.listPremiumUsers);
app.post('/api/v1/admin/premium-users', protect, restrictTo('admin'), adminController.createPremiumUser);
app.patch('/api/v1/admin/premium-users/:id', protect, restrictTo('admin'), adminController.setPremiumStatus);

// ----- Materials -----
// Premium-only access helper
const requirePremium = (req, res, next) => {
  try {
    if (req.user?.role === 'admin' || req.user?.role === 'masteradmin') return next(); // admins and master admins allowed
    if (!req.user?.isPremium) {
      return res.status(403).json({ status: 'fail', message: 'Premium access required' });
    }
    return next();
  } catch (e) {
    return res.status(403).json({ status: 'fail', message: 'Premium access required' });
  }
};

// List materials (premium users and admins)
app.get('/api/v1/materials', protect, requirePremium, materialController.listMaterials);
// Admin upload material (PDF)
app.post(
  '/api/v1/materials',
  protect,
  restrictTo('admin'),
  materialController.uploadMaterial,
  materialController.createMaterial
);
// Admin delete material
app.delete('/api/v1/materials/:id', protect, restrictTo('admin'), materialController.deleteMaterial);

// Material view/download proxies (premium/admin)
app.get('/api/v1/materials/:id/view', protect, requirePremium, materialController.streamMaterialInline);
app.get('/api/v1/materials/:id/download', protect, requirePremium, materialController.streamMaterialDownload);

// ----- Assessments -----
// Admin: manage assessments
app.get('/api/v1/assessments', protect, restrictTo('admin'), assessmentController.listAssessments);
app.post(
  '/api/v1/assessments',
  protect,
  restrictTo('admin'),
  assessmentController.uploadAssessmentMedia,
  assessmentController.createAssessment
);
app.patch(
  '/api/v1/assessments/:id',
  protect,
  restrictTo('admin'),
  assessmentController.uploadAssessmentMedia,
  assessmentController.updateAssessment
);
app.delete('/api/v1/assessments/:id', protect, restrictTo('admin'), assessmentController.deleteAssessment);
app.patch('/api/v1/assessments/:id/assign', protect, restrictTo('admin'), assessmentController.assignUsers);

// Users: my assessments and submissions
app.get('/api/v1/assessments/mine', protect, assessmentController.listMyAssessments);
app.post(
  '/api/v1/assessments/:id/submit',
  protect,
  assessmentController.uploadSubmissionFile,
  assessmentController.submitAssessment
);

// Admin: review submissions
app.get('/api/v1/assessment-submissions', protect, restrictTo('admin'), assessmentController.listSubmissions);
app.patch('/api/v1/assessment-submissions/:id/review', protect, restrictTo('admin'), assessmentController.reviewSubmission);
app.delete('/api/v1/assessment-submissions/:id', protect, restrictTo('admin'), assessmentController.deleteSubmission);

// ----- Groups (Premium-only for users, Admin can manage) -----
// Groups
app.post('/api/v1/groups', protect, restrictTo('admin'), groupController.createGroup);
app.get('/api/v1/groups', protect, requirePremium, groupController.listGroups);
app.patch('/api/v1/groups/:id/add-member', protect, restrictTo('admin'), groupController.addMemberByEmail);
app.patch('/api/v1/groups/:id/remove-member', protect, restrictTo('admin'), groupController.removeMember);
app.delete('/api/v1/groups/:id', protect, restrictTo('admin'), groupController.deleteGroup);

// Group Messages
app.get('/api/v1/groups/:id/messages', protect, requirePremium, groupMessageController.listMessages);
app.post(
  '/api/v1/groups/:id/messages',
  protect,
  requirePremium,
  groupMessageController.uploadMessageMedia,
  groupMessageController.sendMessage
);
app.delete('/api/v1/group-messages/:messageId', protect, requirePremium, groupMessageController.deleteMessage);

// ----- Users (profile and admin) -----
// All user routes require auth
app.get('/api/v1/users/me', protect, authController.getMe, getUser);
app.patch('/api/v1/users/update-me', protect, uploadUserPhoto, resizeUserPhoto, authController.updateMe);
app.patch('/api/v1/users/update-password', protect, authController.updatePassword);
app.delete('/api/v1/users/delete-me', protect, authController.deleteMe);

// User data
app.get('/api/v1/users/my-courses', protect, getMyEnrolledCourses);
app.get('/api/v1/users/my-reviews', protect, getMyReviews);
app.get('/api/v1/users/my-bookings', protect, getMyBookings);

// Admin-only user management
app.get('/api/v1/users', protect, restrictTo('admin'), getAllUsersController);
app.get('/api/v1/users/stats/users', protect, restrictTo('admin'), getUserStats);
app.get('/api/v1/users/:id', protect, restrictTo('admin'), getUser);
app.patch('/api/v1/users/:id', protect, restrictTo('admin'), updateUserController);
app.delete('/api/v1/users/:id', protect, restrictTo('admin'), deleteUserController);

// ----- Awards -----
// Public
app.get('/api/v1/awards', awardController.getAllAwards);
app.get('/api/v1/awards/featured', awardController.getFeaturedAwards);
app.get('/api/v1/awards/category/:category', awardController.getAwardsByCategory);
app.get('/api/v1/awards/:id', awardController.getAward);
// Admin
app.post(
  '/api/v1/awards',
  protect,
  restrictTo('admin'),
  awardController.uploadAwardImage,
  awardController.resizeAwardImage,
  awardController.createAward
);
app.patch(
  '/api/v1/awards/:id',
  protect,
  restrictTo('admin'),
  awardController.uploadAwardImage,
  awardController.resizeAwardImage,
  awardController.updateAward
);
app.delete('/api/v1/awards/:id', protect, restrictTo('admin'), awardController.deleteAward);

// ----- Champions -----
// Public
app.get('/api/v1/champions', championController.getAllChampions);
app.get('/api/v1/champions/featured', championController.getFeaturedChampions);
app.get('/api/v1/champions/:id', championController.getChampion);
// Admin
app.post(
  '/api/v1/champions',
  protect,
  restrictTo('admin'),
  championController.uploadChampionImage,
  championController.resizeChampionImage,
  championController.createChampion
);
app.patch(
  '/api/v1/champions/:id',
  protect,
  restrictTo('admin'),
  championController.uploadChampionImage,
  championController.resizeChampionImage,
  championController.updateChampion
);
app.delete('/api/v1/champions/:id', protect, restrictTo('admin'), championController.deleteChampion);

// ----- Mentors -----
// Public
app.get('/api/v1/mentors', mentorController.getAllMentors);
app.get('/api/v1/mentors/featured', mentorController.getFeaturedMentors);
app.get('/api/v1/mentors/:id', mentorController.getMentor);
// Admin
app.post(
  '/api/v1/mentors',
  protect,
  restrictTo('admin'),
  mentorController.uploadMentorImage,
  mentorController.resizeMentorImage,
  mentorController.createMentor
);
app.patch(
  '/api/v1/mentors/:id',
  protect,
  restrictTo('admin'),
  mentorController.uploadMentorImage,
  mentorController.resizeMentorImage,
  mentorController.updateMentor
);
app.delete('/api/v1/mentors/:id', protect, restrictTo('admin'), mentorController.deleteMentor);

// ----- Brands (Accreditations & Partnerships) -----
// Public
app.get('/api/v1/brands', brandController.getAllBrands);
app.get('/api/v1/brands/:id', brandController.getBrand);
// Admin
app.post(
  '/api/v1/brands',
  protect,
  restrictTo('admin'),
  brandController.uploadBrandImage,
  brandController.resizeBrandImage,
  brandController.createBrand
);
app.patch(
  '/api/v1/brands/:id',
  protect,
  restrictTo('admin'),
  brandController.uploadBrandImage,
  brandController.resizeBrandImage,
  brandController.updateBrand
);
app.delete('/api/v1/brands/:id', protect, restrictTo('admin'), brandController.deleteBrand);

// ----- Bookings -----
// Protected for all
app.get('/api/v1/bookings/my-bookings', protect, bookingController.getMyBookings);
app.get('/api/v1/bookings/available-slots', protect, bookingController.getAvailableSlots);
app.post('/api/v1/bookings', protect, bookingController.createBooking);
app.get('/api/v1/bookings/:id', protect, bookingController.getBooking);
app.patch('/api/v1/bookings/:id', protect, bookingController.updateBookingStatus);
app.delete('/api/v1/bookings/:id', protect, bookingController.cancelBooking);
// Admin
app.get('/api/v1/bookings', protect, restrictTo('admin'), bookingController.getAllBookings);
app.post('/api/v1/bookings/:id/notes', protect, restrictTo('admin'), bookingController.addAdminNote);
app.get('/api/v1/bookings/status/:status', protect, restrictTo('admin'), bookingController.getAllBookings);
app.get('/api/v1/bookings/date-range', protect, restrictTo('admin'), bookingController.getAllBookings);
// Admin: hard delete booking (keeps existing cancel, accept/reject & meeting link flows intact)
app.delete('/api/v1/bookings/:id/hard-delete', protect, restrictTo('admin'), bookingController.deleteBooking);

// ----- Premium Meetings -----
// User (premium) create + list their meeting requests
app.post('/api/v1/premium-meetings', protect, requirePremium, premiumMeetingController.createMeetingRequest);
app.get('/api/v1/premium-meetings/mine', protect, requirePremium, premiumMeetingController.listMyMeetings);
// Admin manage meetings
app.get('/api/v1/admin/premium-meetings', protect, restrictTo('admin'), premiumMeetingController.listAllMeetings);
app.patch('/api/v1/admin/premium-meetings/:id', protect, restrictTo('admin'), premiumMeetingController.updateMeetingStatus);
app.delete('/api/v1/admin/premium-meetings/:id', protect, restrictTo('admin'), premiumMeetingController.deleteMeeting);

// ----- AI -----
app.get('/api/v1/ai/health', aiController.health);
// Auth required for AI endpoints
app.post('/api/v1/ai/chat', protect, aiController.chat);
app.post('/api/v1/ai/code', protect, aiController.generateCode);
app.post('/api/v1/ai/document', protect, aiController.analyzeDocument);
app.post('/api/v1/ai/image', protect, aiController.generateImage);
app.post('/api/v1/ai/music', protect, aiController.generateMusic);
app.post('/api/v1/ai/video', protect, aiController.generateVideo);

// ----- Tools (aliases for AI) -----
// Public health
app.get('/api/v1/tools/health', aiController.health);
// Non-premium tools (require login but not premium)
app.post('/api/v1/tools/chat', protect, aiController.chat);
app.post('/api/v1/tools/code', protect, aiController.generateCode);
app.post('/api/v1/tools/document', protect, aiController.analyzeDocument);
// Premium tools require premium or admin
app.post('/api/v1/premium-tools/chat', protect, requirePremium, aiController.chat);
app.post('/api/v1/premium-tools/code', protect, requirePremium, aiController.generateCode);
app.post('/api/v1/premium-tools/document', protect, requirePremium, aiController.analyzeDocument);
app.post('/api/v1/premium-tools/image', protect, requirePremium, aiController.generateImage);
app.post('/api/v1/premium-tools/music', protect, requirePremium, aiController.generateMusic);
app.post('/api/v1/premium-tools/video', protect, requirePremium, aiController.generateVideo);

// ----- Resume (Upload + Analysis) -----
app.post(
  '/api/v1/resume/analyze',
  protect,
  resumeController.uploadResume,
  resumeController.analyzeResume
);
// Pasted resume text analysis
app.post(
  '/api/v1/resume/analyze-text',
  protect,
  resumeController.analyzeResumeText
);
// Resume listing and retrieval
app.get('/api/v1/resume', protect, restrictTo('admin'), resumeController.listResumes);
app.get('/api/v1/resume/mine', protect, resumeController.listMyResumes);
app.get('/api/v1/resume/:id', protect, resumeController.getResume);
app.delete('/api/v1/resume/:id', protect, restrictTo('admin'), resumeController.deleteResume);

// In production, serve static files from the Vite build
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the Vite build
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Handle SPA routing, return all requests to the app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // In development, redirect non-API GET requests to Vite dev server
// Redirect all non-API requests to the frontend
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next(); // Skip API requests
  }

  // Use environment variable in production, fallback to localhost in dev
  const FRONTEND_URL =
    process.env.FRONTEND_URL || 'http://localhost:5173';

  res.redirect(`${FRONTEND_URL}${req.originalUrl}`);
});

}

// Handle 404
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`,
  });});

// Error handling middleware
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// MongoDB Connection
let dbConnection;
const connectDB = async () => {
  try {
    if (dbConnection) {
      return dbConnection;
    }
    
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds timeout
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Ensure admin user exists after successful connection
    await ensureAdminUser();
    // Ensure review indexes are correct for optional course reviews
    await ensureReviewIndexes();
    // Ensure article indexes (handle legacy slug index)
    await ensureArticleIndexes();
    
    dbConnection = conn;
    
    // Add event listeners for connection issues
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Reconnecting...');
      connectDB(); // Attempt to reconnect
    });
    
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('Full error details:', error);
    // Don't exit in development to allow for auto-restart
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Serve static files from the Vite dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA fallback - return index.html for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
  res.status(404).json({ message: 'Not Found' });
});

// Start the server
let serverInstance;
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    
    // Start the server and store the instance
    serverInstance = app.listen(PORT, () => {
      console.log(`✅ Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      if (process.env.NODE_ENV !== 'production' && process.env.EMBED_VITE === 'true') {
        console.log(`🔧 Vite dev server running at http://localhost:5173`);
      }
    });

    // Initialize Socket.IO for realtime group chat
    const io = new SocketIOServer(serverInstance, {
      cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173','https://testing.testing.careerredefine.com'],
        credentials: true,
      },
    });
    
    // Provide IO to message controller for broadcasting
    if (groupMessageController?.setIO) groupMessageController.setIO(io);

    io.on('connection', (socket) => {
      // Client should emit { groupId } to join a group room
      socket.on('group:join', ({ groupId }) => {
        if (!groupId) return;
        socket.join(`group:${groupId}`);
      });
      socket.on('group:leave', ({ groupId }) => {
        if (!groupId) return;
        socket.leave(`group:${groupId}`);
      });
      socket.on('disconnect', () => {});
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.log('UNHANDLED REJECTION! 💥 Shutting down...');
      console.log(err.name, err.message);
      if (serverInstance) {
        serverInstance.close(() => {
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    });

    // Handle SIGTERM for graceful shutdown
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
      if (serverInstance) {
        serverInstance.close(() => {
          console.log('💥 Process terminated!');
        });
      }
    });
    
    return serverInstance;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Function to start the Vite dev server in development
async function startViteDevServer() {
  if (process.env.NODE_ENV !== 'production' && process.env.EMBED_VITE === 'true') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          clientPort: 5173
        }
      },
      appType: 'spa',
      base: '/'
    });
    
    // Use vite's connect instance as middleware
    app.use(vite.middlewares);
    
    // Serve Vite dev server for all non-API routes in development
    app.use('*', async (req, res, next) => {
      // Skip API routes
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      
      try {
        const url = req.originalUrl;
        const template = await vite.transformIndexHtml(url, `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <link rel="icon" type="image/x-icon" href="/favicon.ico">
              <title>careerRedefine Platform</title>
            </head>
            <body>
              <div id="root"></div>
              <script type="module" src="/src/main.tsx"></script>
            </body>
          </html>
        `);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }
}

// Export the app and startServer function
export { app, startServer };

// Only start the server if this file is run directly (ESM-safe)
const isDirectRun = (
  process.env.NODE_ENV !== 'test' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);
if (isDirectRun) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  if (serverInstance) {
    serverInstance.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Start Vite dev server in development
if (process.env.NODE_ENV !== 'production' && process.env.EMBED_VITE === 'true') {
  startViteDevServer().catch(err => {
    console.error('Error starting Vite dev server:', err);
    process.exit(1);
  });
  
  // In development, proxy all non-API and non-asset requests to Vite dev server
  app.use((req, res, next) => {
    const isApiRequest = req.path.startsWith('/api/');
    const isAssetRequest = /\.(js|css|png|jpg|jpeg|gif|ico|svg|json|map)$/.test(req.path);
    
    if (isApiRequest || isAssetRequest) {
      return next();
    }
    
    // For all other requests in development, redirect to Vite dev server
    res.redirect(`http://localhost:5173${req.originalUrl}`);
  });
}

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('💥 Process terminated!');
    });
  }
});

export default app;
