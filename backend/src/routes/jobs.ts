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
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  redirect_url: z.string(),
  created: z.string(),
  category: z.string(),
  contract_type: z.string(),
  job_type: z.string(),
});

const jobsResponseSchema = z.object({
  jobs: z.array(jobSchema),
  total: z.number(),
  page: z.number(),
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
      description: 'Search for jobs using Adzuna API',
      tags: ['jobs'],
      querystring: {
        type: 'object',
        properties: {
          keywords: { type: 'string', description: 'Job keywords (optional)' },
          location: { type: 'string', description: 'Location filter (optional)' },
          page: { type: 'integer', default: 1, description: 'Page number' },
          country: { type: 'string', default: 'gb', description: 'Country code (gb, us, au, ca, de, fr, in, nl, nz, pl, ru, sg, za, br, at, be)' },
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
        502: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { keywords?: string; location?: string; page?: string; country?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { keywords = '', location = '', page: pageStr = '1', country = 'gb' } = request.query;
    const page = parseInt(pageStr, 10) || 1;

    app.logger.info({ userId: session.user.id, keywords, location, page, country }, 'Searching jobs');

    try {
      // Build Adzuna URL
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (!appId || !appKey) {
        app.logger.error({ userId: session.user.id }, 'Adzuna credentials not configured');
        return reply.status(502).send({ error: 'Job search unavailable. Please try again.' });
      }

      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
      url.searchParams.append('app_id', appId);
      url.searchParams.append('app_key', appKey);
      url.searchParams.append('results_per_page', '10');
      url.searchParams.append('content-type', 'application/json');

      if (keywords.trim()) {
        url.searchParams.append('what', keywords);
      }
      if (location.trim()) {
        url.searchParams.append('where', location);
      }

      app.logger.debug({ url: url.toString().replace(appKey, '***') }, 'Fetching from Adzuna');

      const response = await fetch(url.toString());

      if (!response.ok) {
        app.logger.warn({ status: response.status, userId: session.user.id }, 'Adzuna API returned non-2xx status');
        return reply.status(502).send({ error: 'Job search unavailable. Please try again.' });
      }

      const data = await response.json() as any;

      // Map Adzuna results to our format
      const jobs = (data.results || []).map((result: any) => ({
        id: String(result.id),
        title: result.title,
        company: result.company?.display_name || 'Unknown Company',
        location: result.location?.display_name || 'Unknown Location',
        description: result.description || '',
        salary_min: result.salary_min || null,
        salary_max: result.salary_max || null,
        redirect_url: result.redirect_url,
        created: result.created,
        category: result.category?.label || 'Unknown',
        contract_type: result.contract_type || 'permanent',
        job_type: result.contract_time || 'full_time',
      }));

      app.logger.info({ jobCount: jobs.length, page, total: data.count }, 'Jobs retrieved successfully');
      return { jobs, total: data.count, page };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to search jobs');
      return reply.status(502).send({ error: 'Job search unavailable. Please try again.' });
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
