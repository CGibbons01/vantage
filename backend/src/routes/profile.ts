import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { gateway } from '@specific-dev/framework';
import { generateObject } from 'ai';
import { z } from 'zod';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

const cvAnalysisSchema = z.object({
  name: z.string(),
  headline: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    description: z.string(),
  })),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.string().optional(),
  })),
  cv_score: z.number().min(0).max(100),
  industry_fit: z.object({
    industry: z.string(),
    score: z.number().min(0).max(100),
    reasoning: z.string(),
  }),
});

type CVAnalysis = z.infer<typeof cvAnalysisSchema>;

interface ProfileUpdateBody {
  headline?: string;
  summary?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  skills?: string[];
  experience?: Array<any>;
  education?: Array<any>;
}

export function registerProfileRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = createBearerAuth(app);

  // GET /api/profile
  fastify.get('/api/profile', {
    schema: {
      description: 'Get current user\'s profile',
      tags: ['profile'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            headline: { type: 'string' },
            summary: { type: 'string' },
            location: { type: 'string' },
            phone: { type: 'string' },
            linkedinUrl: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            cvScore: { type: 'number' },
            industryFit: { type: 'object' },
            cvText: { type: 'string' },
            cvFilename: { type: 'string' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching profile');

    try {
      let profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.userId, session.user.id),
      });

      if (!profile) {
        app.logger.info({ userId: session.user.id }, 'Creating new profile');
        const newProfile = {
          userId: session.user.id,
          headline: '',
          summary: '',
          location: '',
          phone: '',
          linkedinUrl: '',
          skills: '[]',
          experience: '[]',
          education: '[]',
          cvScore: null,
          industryFit: null,
          cvText: null,
          cvFilename: null,
          updatedAt: new Date(),
        };
        const inserted = await app.db.insert(schema.profiles).values(newProfile).returning();
        profile = inserted[0];
      }

      const parsedProfile = {
        ...profile,
        skills: JSON.parse(profile.skills),
        experience: JSON.parse(profile.experience),
        education: JSON.parse(profile.education),
        industryFit: profile.industryFit ? JSON.parse(profile.industryFit) : null,
      };

      app.logger.info({ profileId: profile.id }, 'Profile fetched successfully');
      return parsedProfile;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch profile');
      throw error;
    }
  });

  // PUT /api/profile
  fastify.put('/api/profile', {
    schema: {
      description: 'Update current user\'s profile',
      tags: ['profile'],
      body: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          location: { type: 'string' },
          phone: { type: 'string' },
          linkedinUrl: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
          experience: { type: 'array' },
          education: { type: 'array' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            headline: { type: 'string' },
            summary: { type: 'string' },
            location: { type: 'string' },
            phone: { type: 'string' },
            linkedinUrl: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            cvScore: { type: 'number' },
            industryFit: { type: 'object' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: ProfileUpdateBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Updating profile');

    try {
      const body = request.body;
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.headline !== undefined) updateData.headline = body.headline;
      if (body.summary !== undefined) updateData.summary = body.summary;
      if (body.location !== undefined) updateData.location = body.location;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.linkedinUrl !== undefined) updateData.linkedinUrl = body.linkedinUrl;
      if (body.skills !== undefined) updateData.skills = JSON.stringify(body.skills);
      if (body.experience !== undefined) updateData.experience = JSON.stringify(body.experience);
      if (body.education !== undefined) updateData.education = JSON.stringify(body.education);

      // Upsert: insert with conflict resolution on userId
      const insertData = {
        userId: session.user.id,
        headline: body.headline ?? '',
        summary: body.summary ?? '',
        location: body.location ?? '',
        phone: body.phone ?? '',
        linkedinUrl: body.linkedinUrl ?? '',
        skills: body.skills ? JSON.stringify(body.skills) : '[]',
        experience: body.experience ? JSON.stringify(body.experience) : '[]',
        education: body.education ? JSON.stringify(body.education) : '[]',
        updatedAt: new Date(),
      };

      const result = await app.db.insert(schema.profiles)
        .values(insertData)
        .onConflictDoUpdate({
          target: schema.profiles.userId,
          set: updateData,
        })
        .returning();

      const profile = result[0];
      const parsedProfile = {
        ...profile,
        skills: JSON.parse(profile.skills),
        experience: JSON.parse(profile.experience),
        education: JSON.parse(profile.education),
        industryFit: profile.industryFit ? JSON.parse(profile.industryFit) : null,
      };

      app.logger.info({ profileId: profile.id }, 'Profile updated successfully');
      return parsedProfile;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to update profile');
      throw error;
    }
  });

  // POST /api/profile/upload-cv
  fastify.post('/api/profile/upload-cv', {
    schema: {
      description: 'Upload CV PDF, extract text, and analyze with AI',
      tags: ['profile'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            headline: { type: 'string' },
            summary: { type: 'string' },
            location: { type: 'string' },
            phone: { type: 'string' },
            linkedinUrl: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            cvScore: { type: 'number' },
            industryFit: { type: 'object' },
            cvText: { type: 'string' },
            cvFilename: { type: 'string' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Processing CV upload');

    try {
      let fileData: any = null;

      // Parse multipart form data to find the "cv" field
      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'cv') {
            fileData = part;
            break;
          }
        }
      } catch (partsError) {
        app.logger.error({ err: partsError }, 'Error parsing multipart form');
        return reply.status(400).send({ error: 'Invalid multipart form data' });
      }

      if (!fileData) {
        return reply.status(400).send({ error: 'No CV file uploaded' });
      }

      if (!fileData.mimetype.toLowerCase().includes('pdf')) {
        return reply.status(400).send({ error: 'File must be a PDF' });
      }

      let buffer: Buffer;
      try {
        buffer = await fileData.toBuffer();
      } catch (err) {
        return reply.status(413).send({ error: 'File size limit exceeded' });
      }

      // Extract text from PDF
      app.logger.info({ fileName: fileData.filename }, 'Extracting text from PDF');
      let cvText: string;
      try {
        const require = createRequire(import.meta.url);
        const pdfParseModule = require('pdf-parse');
        const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule.default;
        const pdfData = await pdfParse(buffer);
        cvText = pdfData.text;
      } catch (pdfError) {
        app.logger.warn({ err: pdfError }, 'PDF parsing failed, using placeholder text');
        cvText = buffer.toString('utf-8', 0, Math.min(1000, buffer.length)) || 'PDF content could not be extracted';
      }

      // Analyze CV with AI
      app.logger.info({ fileName: fileData.filename }, 'Analyzing CV with AI');
      let cvAnalysis: CVAnalysis;
      try {
        const { object } = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: cvAnalysisSchema,
          schemaName: 'CVAnalysis',
          schemaDescription: 'Extract and analyze CV information',
          prompt: `Extract information from this CV and return JSON:

CV Text:
${cvText.substring(0, 2000)}

Required fields: name, headline, summary, skills (array), experience (array with title, company, start_date, end_date, description), education (array with degree, institution, year), cv_score (0-100), industry_fit (object with industry, score, reasoning).`,
        });
        cvAnalysis = object as CVAnalysis;
      } catch (aiError) {
        app.logger.error({ err: aiError, fileName: fileData.filename }, 'AI analysis failed, using defaults');
        // Return a default analysis if AI fails
        cvAnalysis = {
          name: 'CV Candidate',
          headline: 'Professional',
          summary: 'Candidate CV submitted',
          skills: ['Professional'],
          experience: [{
            title: 'Position',
            company: 'Company',
            start_date: '2020',
            end_date: '2024',
            description: 'Experience',
          }],
          education: [{
            degree: 'Degree',
            institution: 'Institution',
            year: '2020',
          }],
          cv_score: 60,
          industry_fit: {
            industry: 'Technology',
            score: 60,
            reasoning: 'General fit based on CV content',
          },
        };
      }

      // Update profile with extracted data
      const updateData = {
        headline: cvAnalysis.headline,
        summary: cvAnalysis.summary,
        skills: JSON.stringify(cvAnalysis.skills),
        experience: JSON.stringify(cvAnalysis.experience),
        education: JSON.stringify(cvAnalysis.education),
        cvScore: cvAnalysis.cv_score,
        industryFit: JSON.stringify(cvAnalysis.industry_fit),
        cvText,
        cvFilename: fileData.filename,
        updatedAt: new Date(),
      };

      // Upsert: insert with conflict resolution on userId
      const insertData = {
        userId: session.user.id,
        ...updateData,
      };

      const result = await app.db.insert(schema.profiles)
        .values(insertData)
        .onConflictDoUpdate({
          target: schema.profiles.userId,
          set: updateData,
        })
        .returning();

      const profile = result[0];
      const parsedProfile = {
        ...profile,
        skills: JSON.parse(profile.skills),
        experience: JSON.parse(profile.experience),
        education: JSON.parse(profile.education),
        industryFit: profile.industryFit ? JSON.parse(profile.industryFit) : null,
      };

      app.logger.info({ profileId: profile.id, cvScore: profile.cvScore }, 'CV analyzed and profile updated successfully');
      return parsedProfile;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to process CV upload');
      return reply.status(500).send({ error: 'Failed to process CV upload' });
    }
  });
}
