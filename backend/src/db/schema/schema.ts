import { pgTable, uuid, text, real, timestamp, integer } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  headline: text('headline'),
  summary: text('summary'),
  location: text('location'),
  phone: text('phone'),
  linkedinUrl: text('linkedin_url'),
  skills: text('skills').notNull().default('[]'),
  experience: text('experience').notNull().default('[]'),
  education: text('education').notNull().default('[]'),
  cvScore: real('cv_score'),
  industryFit: text('industry_fit'),
  cvText: text('cv_text'),
  cvFilename: text('cv_filename'),
  industryScores: text('industry_scores'),
  overallScore: real('overall_score'),
  improvementTips: text('improvement_tips'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobApplications = pgTable('job_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  jobId: text('job_id').notNull(),
  jobTitle: text('job_title').notNull(),
  company: text('company').notNull(),
  location: text('location').notNull(),
  jobUrl: text('job_url').notNull(),
  status: text('status').notNull().default('saved'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const coverLetters = pgTable('cover_letters', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  jobTitle: text('job_title').notNull(),
  companyName: text('company_name').notNull(),
  content: text('content').notNull(),
  wordCount: integer('word_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
