import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateText } from 'ai';
import { gateway } from '@specific-dev/framework';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

interface AdzunaSearchResult {
  adref: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  category?: { label?: string };
  contract_type?: string;
}

interface JobMatch {
  job_id: string;
  match_percentage: number;
  matched_skills: string[];
  missing_skills: string[];
  recommendation: string;
}

export function registerJobRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = createBearerAuth(app);

  // GET /api/jobs/search
  fastify.get('/api/jobs/search', {
    schema: {
      description: 'Search for jobs via Adzuna API',
      tags: ['jobs'],
      querystring: {
        type: 'object',
        properties: {
          keywords: { type: 'string', description: 'Search keywords (optional)' },
          location: { type: 'string', description: 'Filter by location (optional)' },
          page: { type: 'integer', default: 1, description: 'Page number (1-indexed)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  company: { type: 'string' },
                  location: { type: 'string' },
                  description: { type: 'string' },
                  salary_min: { type: ['number', 'null'] },
                  salary_max: { type: ['number', 'null'] },
                  redirect_url: { type: 'string' },
                  created: { type: 'string' },
                  category: { type: 'string' },
                  contract_type: { type: ['string', 'null'] },
                },
              },
            },
            total: { type: 'number' },
            page: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
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
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (!appId || !appKey) {
        app.logger.error({}, 'Adzuna credentials not configured');
        return reply.status(500).send({ error: 'Failed to fetch jobs' });
      }

      const url = new URL(`https://api.adzuna.com/v1/api/jobs/gb/search/${page}`);
      url.searchParams.append('app_id', appId);
      url.searchParams.append('app_key', appKey);
      url.searchParams.append('results_per_page', '20');
      url.searchParams.append('content-type', 'application/json');

      if (keywords && keywords.trim()) {
        url.searchParams.append('what', keywords.trim());
      }

      if (location && location.trim()) {
        url.searchParams.append('where', location.trim());
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        app.logger.error({ status: response.status }, 'Adzuna API request failed');
        return reply.status(500).send({ error: 'Failed to fetch jobs' });
      }

      const data = await response.json() as any;
      const jobs = (data.results || []).map((result: AdzunaSearchResult) => ({
        id: result.adref,
        title: result.title,
        company: result.company?.display_name ?? '',
        location: result.location?.display_name ?? '',
        description: result.description,
        salary_min: result.salary_min ?? null,
        salary_max: result.salary_max ?? null,
        redirect_url: result.redirect_url,
        created: result.created,
        category: result.category?.label ?? '',
        contract_type: result.contract_type ?? null,
      }));

      app.logger.info({ jobCount: jobs.length, total: data.count, page }, 'Jobs fetched successfully');
      return { jobs, total: data.count, page };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch jobs');
      return reply.status(500).send({ error: 'Failed to fetch jobs' });
    }
  });

  // POST /api/jobs/match
  fastify.post('/api/jobs/match', {
    schema: {
      description: 'Match a CV against multiple jobs using AI analysis',
      tags: ['jobs'],
      body: {
        type: 'object',
        required: ['cv_text', 'jobs'],
        properties: {
          cv_text: { type: 'string', description: 'Full CV text content' },
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
                required_skills: { type: 'array', items: { type: 'string' }, default: [] },
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  job_id: { type: 'string' },
                  match_percentage: { type: 'number', minimum: 0, maximum: 100 },
                  matched_skills: { type: 'array', items: { type: 'string' } },
                  missing_skills: { type: 'array', items: { type: 'string' } },
                  recommendation: { type: 'string' },
                },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cv_text: string; jobs: Array<{ id: string; title: string; description: string; company: string; required_skills?: string[] }> } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text, jobs } = request.body;

    if (!cv_text || !cv_text.trim()) {
      return reply.status(400).send({ error: 'cv_text is required and cannot be empty' });
    }

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return reply.status(400).send({ error: 'jobs array is required and cannot be empty' });
    }

    app.logger.info({ userId: session.user.id, jobCount: jobs.length }, 'Matching CV against jobs');

    try {
      const jobsList = jobs.map((job, idx) => {
        const skills = job.required_skills && Array.isArray(job.required_skills) ? job.required_skills : [];
        return `${idx + 1}. Job ID: ${job.id}
   Title: ${job.title}
   Company: ${job.company}
   Required Skills: ${skills.join(', ') || 'Not specified'}
   Description: ${job.description}`;
      }).join('\n\n');

      const prompt = `Analyze the following CV against multiple job listings. For each job, provide:
1. Match percentage (0-100)
2. List of matched skills (skills present in CV that match job requirements)
3. List of missing skills (required skills not found in CV)
4. A short recommendation (1 sentence)

Return ONLY a valid JSON array with objects containing: job_id, match_percentage, matched_skills, missing_skills, recommendation

CV TEXT:
${cv_text}

JOBS TO MATCH:
${jobsList}

Return ONLY valid JSON array, no other text.`;

      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o-mini'),
        prompt,
      });

      let parsed: JobMatch[];
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        app.logger.warn({ err: parseErr }, 'Failed to parse JSON response, attempting to extract JSON');
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON array found in response');
        }
      }

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not a JSON array');
      }

      const matches = parsed.map((match: any) => ({
        job_id: String(match.job_id),
        match_percentage: Math.min(100, Math.max(0, Number(match.match_percentage) || 0)),
        matched_skills: Array.isArray(match.matched_skills) ? match.matched_skills.map((s: any) => String(s)) : [],
        missing_skills: Array.isArray(match.missing_skills) ? match.missing_skills.map((s: any) => String(s)) : [],
        recommendation: String(match.recommendation || ''),
      }));

      app.logger.info({ userId: session.user.id, matchCount: matches.length }, 'CV matching completed successfully');
      return { matches };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to analyse CV');
      return reply.status(500).send({ error: 'Failed to analyse CV' });
    }
  });
}
