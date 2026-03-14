import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { gateway } from '@specific-dev/framework';
import { generateObject } from 'ai';
import { z } from 'zod';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

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
  const requireAuth = app.requireAuth();

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
          id: randomUUID(),
          userId: session.user.id,
          skills: '[]',
          experience: '[]',
          education: '[]',
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

      const updated = await app.db.update(schema.profiles)
        .set(updateData)
        .where(eq(schema.profiles.userId, session.user.id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const profile = updated[0];
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
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      if (!data.mimetype.includes('pdf')) {
        return reply.status(400).send({ error: 'File must be a PDF' });
      }

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        return reply.status(413).send({ error: 'File size limit exceeded' });
      }

      // Extract text from PDF
      app.logger.info({ fileName: data.filename }, 'Extracting text from PDF');
      const pdfParseModule = await import('pdf-parse') as any;
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const pdfData = await pdfParse(buffer);
      const cvText = pdfData.text;

      // Analyze CV with AI
      app.logger.info({ fileName: data.filename }, 'Analyzing CV with AI');
      const { object } = await generateObject({
        model: gateway('openai/gpt-5-mini'),
        schema: cvAnalysisSchema,
        schemaName: 'CVAnalysis',
        schemaDescription: 'Extract and analyze CV information',
        prompt: `Analyze this CV and extract structured information:\n\n${cvText}`,
      });

      const cvAnalysis = object as CVAnalysis;

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
        cvFilename: data.filename,
        updatedAt: new Date(),
      };

      const updated = await app.db.update(schema.profiles)
        .set(updateData)
        .where(eq(schema.profiles.userId, session.user.id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const profile = updated[0];
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
      throw error;
    }
  });
}
