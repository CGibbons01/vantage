import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

interface JobSearchQuerystring {
  keywords: string;
  location?: string;
  page?: number;
  results_per_page?: number;
}

interface AdzunaJob {
  id: string;
  title: string;
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
  };
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  category: {
    label: string;
  };
}

interface TransformedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  category: string;
}

export function registerJobRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/jobs/search
  fastify.get('/api/jobs/search', {
    schema: {
      description: 'Search jobs via Adzuna API',
      tags: ['jobs'],
      querystring: {
        type: 'object',
        required: ['keywords'],
        properties: {
          keywords: { type: 'string' },
          location: { type: 'string', default: 'uk' },
          page: { type: 'integer', default: 1 },
          results_per_page: { type: 'integer', default: 20 },
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
      },
    },
  }, async (request: FastifyRequest<{ Querystring: JobSearchQuerystring }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { keywords, location = 'uk', page = 1, results_per_page = 20 } = request.query;

    app.logger.info({ keywords, location, page, results_per_page }, 'Searching jobs');

    try {
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (!appId || !appKey) {
        app.logger.error({}, 'Adzuna credentials not configured');
        return reply.status(500).send({ error: 'Job search not available' });
      }

      const url = new URL(`https://api.adzuna.com/v1/api/jobs/gb/search/${page}`);
      url.searchParams.append('app_id', appId);
      url.searchParams.append('app_key', appKey);
      url.searchParams.append('results_per_page', results_per_page.toString());
      url.searchParams.append('what', keywords);
      url.searchParams.append('where', location);
      url.searchParams.append('content-type', 'application/json');

      const response = await fetch(url.toString());
      const data = await response.json() as any;

      if (!response.ok) {
        app.logger.error({ status: response.status, data }, 'Adzuna API error');
        return reply.status(response.status).send({ error: 'Failed to search jobs' });
      }

      const transformedJobs: TransformedJob[] = (data.results || []).map((job: AdzunaJob) => ({
        id: job.id,
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name,
        description: job.description,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        redirect_url: job.redirect_url,
        created: job.created,
        category: job.category.label,
      }));

      app.logger.info({ count: transformedJobs.length, total: data.count, page }, 'Jobs fetched successfully');

      return {
        jobs: transformedJobs,
        total: data.count,
        page,
      };
    } catch (error) {
      app.logger.error({ err: error, keywords, location }, 'Failed to search jobs');
      throw error;
    }
  });

  // GET /api/jobs/:id
  fastify.get('/api/jobs/:id', {
    schema: {
      description: 'Get single job detail from Adzuna',
      tags: ['jobs'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            description: { type: 'string' },
            salary_min: { type: 'number' },
            salary_max: { type: 'number' },
            redirect_url: { type: 'string' },
            created: { type: 'string' },
            category: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;

    app.logger.info({ jobId: id }, 'Fetching job detail');

    try {
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (!appId || !appKey) {
        app.logger.error({}, 'Adzuna credentials not configured');
        return reply.status(500).send({ error: 'Job search not available' });
      }

      const url = new URL('https://api.adzuna.com/v1/api/jobs/gb/search/1');
      url.searchParams.append('app_id', appId);
      url.searchParams.append('app_key', appKey);
      url.searchParams.append('what', id);
      url.searchParams.append('content-type', 'application/json');

      const response = await fetch(url.toString());
      const data = await response.json() as any;

      if (!response.ok || !data.results || data.results.length === 0) {
        app.logger.warn({ jobId: id, status: response.status }, 'Job not found');
        return reply.status(404).send({ error: 'Job not found' });
      }

      const job = data.results[0] as AdzunaJob;
      const transformed: TransformedJob = {
        id: job.id,
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name,
        description: job.description,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        redirect_url: job.redirect_url,
        created: job.created,
        category: job.category.label,
      };

      app.logger.info({ jobId: id }, 'Job detail fetched successfully');
      return transformed;
    } catch (error) {
      app.logger.error({ err: error, jobId: id }, 'Failed to fetch job detail');
      throw error;
    }
  });
}
