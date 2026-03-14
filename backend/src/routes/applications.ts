import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface CreateApplicationBody {
  job_id: string;
  job_title: string;
  company: string;
  location: string;
  job_url: string;
  status?: string;
}

interface UpdateApplicationBody {
  status?: string;
  notes?: string;
}

export function registerApplicationRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/applications
  fastify.get('/api/applications', {
    schema: {
      description: 'List user\'s saved/applied jobs',
      tags: ['applications'],
      response: {
        200: {
          type: 'object',
          properties: {
            applications: { type: 'array' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Listing applications');

    try {
      const applications = await app.db.query.jobApplications.findMany({
        where: eq(schema.jobApplications.userId, session.user.id),
        orderBy: desc(schema.jobApplications.createdAt),
      });

      app.logger.info({ userId: session.user.id, count: applications.length }, 'Applications listed successfully');
      return { applications };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to list applications');
      throw error;
    }
  });

  // POST /api/applications
  fastify.post('/api/applications', {
    schema: {
      description: 'Save a job application',
      tags: ['applications'],
      body: {
        type: 'object',
        required: ['job_id', 'job_title', 'company', 'location', 'job_url'],
        properties: {
          job_id: { type: 'string' },
          job_title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          job_url: { type: 'string' },
          status: { type: 'string', default: 'saved' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            jobId: { type: 'string' },
            jobTitle: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            jobUrl: { type: 'string' },
            status: { type: 'string' },
            appliedAt: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateApplicationBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { job_id, job_title, company, location, job_url, status = 'saved' } = request.body;

    app.logger.info({ userId: session.user.id, jobId: job_id, jobTitle: job_title }, 'Creating application');

    try {
      const application = {
        id: randomUUID(),
        userId: session.user.id,
        jobId: job_id,
        jobTitle: job_title,
        company,
        location,
        jobUrl: job_url,
        status,
        createdAt: new Date(),
      };

      const inserted = await app.db.insert(schema.jobApplications).values(application).returning();

      app.logger.info({ applicationId: inserted[0].id, jobTitle: job_title }, 'Application created successfully');
      reply.status(201);
      return inserted[0];
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, jobId: job_id }, 'Failed to create application');
      throw error;
    }
  });

  // PUT /api/applications/:id
  fastify.put('/api/applications/:id', {
    schema: {
      description: 'Update application status/notes',
      tags: ['applications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            jobId: { type: 'string' },
            jobTitle: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            jobUrl: { type: 'string' },
            status: { type: 'string' },
            appliedAt: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { status, notes } = request.body;

    app.logger.info({ userId: session.user.id, applicationId: id }, 'Updating application');

    try {
      // Check ownership
      const application = await app.db.query.jobApplications.findFirst({
        where: eq(schema.jobApplications.id, id),
      });

      if (!application) {
        return reply.status(404).send({ error: 'Application not found' });
      }

      if (application.userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, applicationId: id, ownerId: application.userId }, 'Unauthorized application update');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const updateData: any = {};
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;

      const updated = await app.db.update(schema.jobApplications)
        .set(updateData)
        .where(eq(schema.jobApplications.id, id))
        .returning();

      app.logger.info({ applicationId: id, status }, 'Application updated successfully');
      return updated[0];
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, applicationId: id }, 'Failed to update application');
      throw error;
    }
  });

  // DELETE /api/applications/:id
  fastify.delete('/api/applications/:id', {
    schema: {
      description: 'Remove application',
      tags: ['applications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;

    app.logger.info({ userId: session.user.id, applicationId: id }, 'Deleting application');

    try {
      // Check ownership
      const application = await app.db.query.jobApplications.findFirst({
        where: eq(schema.jobApplications.id, id),
      });

      if (!application) {
        return reply.status(404).send({ error: 'Application not found' });
      }

      if (application.userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, applicationId: id, ownerId: application.userId }, 'Unauthorized application delete');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      await app.db.delete(schema.jobApplications)
        .where(eq(schema.jobApplications.id, id));

      app.logger.info({ applicationId: id }, 'Application deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, applicationId: id }, 'Failed to delete application');
      throw error;
    }
  });
}
