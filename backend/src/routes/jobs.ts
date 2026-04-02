import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateText } from 'ai';
import { gateway } from '@specific-dev/framework';
import { z } from 'zod';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

const jobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  description: z.string(),
  salary_min: z.number(),
  salary_max: z.number(),
  redirect_url: z.string(),
  created: z.string(),
  category: z.string(),
  contract_type: z.enum(['full_time', 'part_time', 'contract']),
  job_type: z.string(),
});

const jobsResponseSchema = z.object({
  jobs: z.array(jobSchema),
});

const matchSchema = z.object({
  job_id: z.string(),
  match_percentage: z.number().min(0).max(100),
  matched_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  recommendation: z.string(),
});

const matchesResponseSchema = z.object({
  matches: z.array(matchSchema),
});

interface MatchJobsBody {
  cv_text: string;
  jobs: Array<{ id: string; title: string; description: string; company: string; required_skills?: string[] }>;
}

export function registerJobRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = createBearerAuth(app);

  // GET /api/jobs/search
  fastify.get('/api/jobs/search', {
    schema: {
      description: 'Search for jobs using AI-generated mock data',
      tags: ['jobs'],
      querystring: {
        type: 'object',
        properties: {
          keywords: { type: 'string', description: 'Job keywords (optional)' },
          location: { type: 'string', description: 'Location filter (optional)' },
          page: { type: 'integer', default: 1, description: 'Page number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobs: { type: 'array' },
            total: { type: 'number' },
            page: { type: 'number' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { keywords?: string; location?: string; page?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { keywords = '', location = '', page: pageStr = '1' } = request.query;
    const page = parseInt(pageStr, 10) || 1;

    app.logger.info({ userId: session.user.id, keywords, location, page }, 'Searching jobs');

    try {
      app.logger.debug({ keywords, location, page }, 'Calling generateText for jobs');
      const { text } = await generateText({
        model: gateway('google/gemini-3-flash'),
        prompt: `Generate 10 realistic UK job listings for the role "${keywords || 'Software Engineer'}" in "${location || 'London'}". Return ONLY a valid JSON array with this structure for each job: {"id":"string","title":"string","company":"string","location":"string","description":"string","salary_min":number,"salary_max":number,"redirect_url":"string","created":"string","category":"string","contract_type":"full_time|part_time|contract","job_type":"string"}. Return only the JSON array, no other text.`,
      });

      app.logger.debug({ textLength: text.length }, 'generateText response length');

      // Parse the JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const jobs = JSON.parse(jsonMatch[0]);
      jobsResponseSchema.parse({ jobs });

      app.logger.info({ jobCount: jobs.length, page }, 'Jobs generated successfully');
      return { jobs, total: jobs.length, page };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to search jobs');
      return reply.status(500).send({ error: 'Failed to search jobs', details: errorMsg });
    }
  });

  // POST /api/jobs/match
  fastify.post('/api/jobs/match', {
    schema: {
      description: 'Match CV against job listings using AI',
      tags: ['jobs'],
      body: {
        type: 'object',
        required: ['cv_text', 'jobs'],
        properties: {
          cv_text: { type: 'string' },
          jobs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'title', 'description', 'company'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                company: { type: 'string' },
                required_skills: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      response: {
        200: { type: 'object', properties: { matches: { type: 'array' } } },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: MatchJobsBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text, jobs } = request.body;

    if (!cv_text || !jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return reply.status(400).send({ error: 'cv_text and jobs array are required' });
    }

    app.logger.info({ userId: session.user.id, jobCount: jobs.length }, 'Matching CV against jobs');

    try {
      app.logger.debug({ jobCount: jobs.length }, 'Calling generateText for job matching');
      const { text } = await generateText({
        model: gateway('google/gemini-3-flash'),
        prompt: `Analyse this CV against the provided job listings and return match scores. CV: ${cv_text}. Jobs: ${JSON.stringify(jobs)}. Return ONLY a valid JSON object with this structure: {"matches":[{"job_id":"string","match_percentage":number,"matched_skills":["string"],"missing_skills":["string"],"recommendation":"string"}]}. Return only the JSON, no other text.`,
      });

      app.logger.debug({ textLength: text.length }, 'generateText response length');

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const response = JSON.parse(jsonMatch[0]);
      matchesResponseSchema.parse(response);

      app.logger.info({ userId: session.user.id, matchCount: response.matches.length }, 'CV matching completed');
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to match CV');
      return reply.status(500).send({ error: 'Failed to match CV', details: errorMsg });
    }
  });
}
