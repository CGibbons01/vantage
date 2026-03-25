import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

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
  const requireAuth = createBearerAuth(app);

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

      // Return mock data if credentials are not configured
      if (!appId || !appKey) {
        app.logger.warn({ keywords, location }, 'Adzuna credentials not configured, returning mock data');
        const mockJobs: TransformedJob[] = [
          {
            id: 'mock_1',
            title: 'Senior Software Engineer',
            company: 'Tech Innovations Ltd',
            location: 'London, UK',
            description: 'We are seeking a Senior Software Engineer with experience in cloud architecture and microservices.',
            salary_min: 70000,
            salary_max: 95000,
            redirect_url: 'https://example.com/job/1',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_2',
            title: 'Data Scientist',
            company: 'Analytics Pro',
            location: 'Manchester, UK',
            description: 'Looking for a Data Scientist to build and deploy ML models for business intelligence.',
            salary_min: 55000,
            salary_max: 80000,
            redirect_url: 'https://example.com/job/2',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_3',
            title: 'Full Stack Developer',
            company: 'Web Solutions Inc',
            location: 'Bristol, UK',
            description: 'Full Stack Developer needed for developing scalable web applications using modern frameworks.',
            salary_min: 45000,
            salary_max: 65000,
            redirect_url: 'https://example.com/job/3',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_4',
            title: 'DevOps Engineer',
            company: 'Cloud Systems',
            location: 'Edinburgh, UK',
            description: 'DevOps Engineer to manage infrastructure, CI/CD pipelines, and containerized applications.',
            salary_min: 50000,
            salary_max: 75000,
            redirect_url: 'https://example.com/job/4',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_5',
            title: 'Machine Learning Engineer',
            company: 'AI Ventures',
            location: 'London, UK',
            description: 'ML Engineer to develop and optimize machine learning models for production systems.',
            salary_min: 60000,
            salary_max: 90000,
            redirect_url: 'https://example.com/job/5',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_6',
            title: 'Product Manager',
            company: 'Digital First Co',
            location: 'London, UK',
            description: 'Experienced Product Manager to lead product strategy and roadmap development.',
            salary_min: 65000,
            salary_max: 85000,
            redirect_url: 'https://example.com/job/6',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_7',
            title: 'Frontend Engineer',
            company: 'Digital Design Studio',
            location: 'Birmingham, UK',
            description: 'Frontend Engineer with expertise in React, TypeScript, and modern web technologies.',
            salary_min: 40000,
            salary_max: 60000,
            redirect_url: 'https://example.com/job/7',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_8',
            title: 'Database Administrator',
            company: 'Enterprise Systems',
            location: 'London, UK',
            description: 'DBA needed to manage and optimize large-scale database systems.',
            salary_min: 45000,
            salary_max: 70000,
            redirect_url: 'https://example.com/job/8',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_9',
            title: 'UX/UI Designer',
            company: 'Creative Digital',
            location: 'London, UK',
            description: 'UX/UI Designer to create intuitive and beautiful user interfaces for web and mobile applications.',
            salary_min: 35000,
            salary_max: 55000,
            redirect_url: 'https://example.com/job/9',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          {
            id: 'mock_10',
            title: 'Solutions Architect',
            company: 'Enterprise Solutions Ltd',
            location: 'London, UK',
            description: 'Solutions Architect to design scalable and secure solutions for enterprise clients.',
            salary_min: 75000,
            salary_max: 110000,
            redirect_url: 'https://example.com/job/10',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
        ];

        app.logger.info({ count: mockJobs.length, page }, 'Returning mock job data');
        return {
          jobs: mockJobs,
          total: mockJobs.length,
          page,
        };
      }

      const url = new URL(`https://api.adzuna.com/v1/api/jobs/gb/search/${page}`);
      url.searchParams.append('app_id', appId);
      url.searchParams.append('app_key', appKey);
      url.searchParams.append('results_per_page', results_per_page.toString());
      url.searchParams.append('what', keywords);
      url.searchParams.append('where', location);
      url.searchParams.append('content-type', 'application/json');

      const response = await fetch(url.toString());

      if (!response.ok) {
        const text = await response.text();
        app.logger.error({ status: response.status, responseText: text.substring(0, 500) }, 'Adzuna API error');
        return reply.status(500).send({ error: 'Job search service is currently unavailable' });
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        app.logger.error({ err: parseError, status: response.status }, 'Failed to parse Adzuna API response');
        return reply.status(500).send({ error: 'Invalid response from job search service' });
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
      return reply.status(500).send({ error: 'Failed to search jobs' });
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
        app.logger.warn({ jobId: id }, 'Adzuna credentials not configured, returning mock job');
        // Return mock job if credentials not configured
        const mockJobMap: { [key: string]: TransformedJob } = {
          'mock_1': {
            id: 'mock_1',
            title: 'Senior Software Engineer',
            company: 'Tech Innovations Ltd',
            location: 'London, UK',
            description: 'We are seeking a Senior Software Engineer with experience in cloud architecture and microservices. This is a full-time role with competitive benefits.',
            salary_min: 70000,
            salary_max: 95000,
            redirect_url: 'https://example.com/job/1',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
          'mock_2': {
            id: 'mock_2',
            title: 'Data Scientist',
            company: 'Analytics Pro',
            location: 'Manchester, UK',
            description: 'Looking for a Data Scientist to build and deploy ML models for business intelligence and analytics.',
            salary_min: 55000,
            salary_max: 80000,
            redirect_url: 'https://example.com/job/2',
            created: new Date().toISOString(),
            category: 'IT Jobs',
          },
        };

        const job = mockJobMap[id];
        if (job) {
          app.logger.info({ jobId: id }, 'Mock job detail returned');
          return job;
        }
        return reply.status(404).send({ error: 'Job not found' });
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
