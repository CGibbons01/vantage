import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRequire } from 'module';
import { eq } from 'drizzle-orm';
import { gateway } from '@specific-dev/framework';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

const cvGenerateBodySchema = z.object({
  name: z.string(),
  email: z.string().email(),
  target_role: z.string(),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    duration: z.string(),
    description: z.string(),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    year: z.string(),
  })),
  skills: z.array(z.string()),
  summary: z.string(),
});

const cvImproveBodySchema = z.object({
  cv_text: z.string(),
  target_role: z.string(),
  focus_areas: z.array(z.enum(['impact_statements', 'keywords', 'formatting', 'achievements', 'summary'])).optional(),
});

const coverLetterBodySchema = z.object({
  applicant_name: z.string(),
  job_title: z.string(),
  company_name: z.string(),
  job_description: z.string(),
  cv_summary: z.string(),
  tone: z.enum(['professional', 'enthusiastic', 'concise']).optional().default('professional'),
});

const jobMatchBodySchema = z.object({
  cv_text: z.string(),
  jobs: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    company: z.string(),
    required_skills: z.array(z.string()).optional(),
  })),
});

const cvGenerateResponseSchema = z.object({
  cv_text: z.string(),
  sections: z.object({
    professional_summary: z.string(),
    experience: z.string(),
    education: z.string(),
    skills: z.string(),
    achievements: z.string(),
  }),
});

const cvImproveResponseSchema = z.object({
  improved_cv_text: z.string(),
  suggestions: z.array(z.string()),
  score_before: z.number().int().min(0).max(100),
  score_after: z.number().int().min(0).max(100),
});

const jobMatchResponseSchema = z.object({
  matches: z.array(z.object({
    job_id: z.string(),
    match_percentage: z.number().int().min(0).max(100),
    matched_skills: z.array(z.string()),
    missing_skills: z.array(z.string()),
    recommendation: z.string(),
  })),
});

const cvScoreResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  industry_fit: z.string(),
  skills: z.array(z.string()),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvements: z.array(z.string()),
  section_scores: z.object({
    summary: z.number().int().min(0).max(100),
    experience: z.number().int().min(0).max(100),
    education: z.number().int().min(0).max(100),
    skills: z.number().int().min(0).max(100),
    formatting: z.number().int().min(0).max(100),
  }),
});

export function registerAIRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/cv/generate
  fastify.post('/api/cv/generate', {
    schema: {
      description: 'Generate a professional ATS-optimized CV using GPT-4o',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['name', 'email', 'target_role', 'experience', 'education', 'skills', 'summary'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          target_role: { type: 'string' },
          experience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                role: { type: 'string' },
                duration: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['company', 'role', 'duration', 'description'],
            },
          },
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                institution: { type: 'string' },
                degree: { type: 'string' },
                year: { type: 'string' },
              },
              required: ['institution', 'degree', 'year'],
            },
          },
          skills: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            cv_text: { type: 'string' },
            sections: {
              type: 'object',
              properties: {
                professional_summary: { type: 'string' },
                experience: { type: 'string' },
                education: { type: 'string' },
                skills: { type: 'string' },
                achievements: { type: 'string' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const validation = cvGenerateBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const body = validation.data;
    app.logger.info({ userId: session.user.id, targetRole: body.target_role }, 'Generating CV');

    try {
      const expText = body.experience.map(e => `${e.role} at ${e.company}: ${e.description}`).join('; ');
      const eduText = body.education.map(e => `${e.degree} - ${e.institution}`).join('; ');

      const prompt = `CV for ${body.name} targeting ${body.target_role}. Exp: ${expText}. Edu: ${eduText}. Skills: ${body.skills.join(', ')}. Return JSON with cv_text and sections.`;

      try {
        const { object } = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: cvGenerateResponseSchema,
          schemaName: 'CVGeneration',
          schemaDescription: 'Generated professional CV with sections',
          prompt,
        });

        app.logger.info({ userId: session.user.id }, 'CV generated successfully');
        return object;
      } catch (aiError) {
        app.logger.error({ err: aiError, userId: session.user.id }, 'CV generation failed');
        return reply.status(500).send({ error: 'Failed to generate CV' });
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate CV');
      return reply.status(500).send({ error: 'Failed to generate CV' });
    }
  });

  // POST /api/cv/improve
  fastify.post('/api/cv/improve', {
    schema: {
      description: 'Improve an existing CV using GPT-4o',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['cv_text', 'target_role'],
        properties: {
          cv_text: { type: 'string' },
          target_role: { type: 'string' },
          focus_areas: {
            type: 'array',
            items: { type: 'string', enum: ['impact_statements', 'keywords', 'formatting', 'achievements', 'summary'] },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            improved_cv_text: { type: 'string' },
            suggestions: { type: 'array', items: { type: 'string' } },
            score_before: { type: 'integer' },
            score_after: { type: 'integer' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const validation = cvImproveBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const body = validation.data;
    app.logger.info({ userId: session.user.id, targetRole: body.target_role }, 'Improving CV');

    try {
      const focus = body.focus_areas?.join(', ') || 'all';
      const prompt = `Improve CV for ${body.target_role}. Focus: ${focus}. CV: ${body.cv_text.substring(0, 300)}. Return JSON with improved_cv_text, suggestions, score_before, score_after.`;

      try {
        const { object } = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: cvImproveResponseSchema,
          schemaName: 'CVImprovement',
          schemaDescription: 'Improved CV with suggestions and scores',
          prompt,
        });

        app.logger.info({ userId: session.user.id, scoreBefore: object.score_before, scoreAfter: object.score_after }, 'CV improved successfully');
        return object;
      } catch (aiError) {
        app.logger.error({ err: aiError, userId: session.user.id }, 'CV improvement failed');
        return reply.status(500).send({ error: 'Failed to improve CV' });
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to improve CV');
      return reply.status(500).send({ error: 'Failed to improve CV' });
    }
  });

  // POST /api/cover-letter/generate
  fastify.post('/api/cover-letter/generate', {
    schema: {
      description: 'Generate a tailored cover letter using GPT-4o',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['applicant_name', 'job_title', 'company_name', 'job_description', 'cv_summary'],
        properties: {
          applicant_name: { type: 'string' },
          job_title: { type: 'string' },
          company_name: { type: 'string' },
          job_description: { type: 'string' },
          cv_summary: { type: 'string' },
          tone: { type: 'string', enum: ['professional', 'enthusiastic', 'concise'], default: 'professional' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            cover_letter: { type: 'string' },
            word_count: { type: 'integer' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const validation = coverLetterBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const body = validation.data;
    app.logger.info({ userId: session.user.id, company: body.company_name, jobTitle: body.job_title }, 'Generating cover letter');

    try {
      const toneGuidance = {
        professional: 'formal, professional, and business-like',
        enthusiastic: 'enthusiastic, energetic, and passionate',
        concise: 'concise, direct, and to-the-point',
      };

      const prompt = `Write a ${toneGuidance[body.tone]} cover letter for the following:

Applicant: ${body.applicant_name}
Target Position: ${body.job_title} at ${body.company_name}

Job Description:
${body.job_description}

Applicant's Background (CV Summary):
${body.cv_summary}

Requirements:
- 3-4 paragraphs
- Specific reference to the company and role
- Highlight relevant experience from the CV summary
- Professional formatting suitable for email or document submission
- Length: 250-350 words`;

      const { text: coverLetterText } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt,
      });

      const wordCount = coverLetterText.split(/\s+/).filter(word => word.length > 0).length;

      app.logger.info({ userId: session.user.id, wordCount }, 'Cover letter generated successfully');
      return { cover_letter: coverLetterText, word_count: wordCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate cover letter');
      return reply.status(500).send({ error: 'Failed to generate cover letter' });
    }
  });

  // POST /api/jobs/match
  fastify.post('/api/jobs/match', {
    schema: {
      description: 'Analyze CV match against multiple job descriptions using GPT-4o',
      tags: ['ai', 'jobs'],
      body: {
        type: 'object',
        required: ['cv_text', 'jobs'],
        properties: {
          cv_text: { type: 'string' },
          jobs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                company: { type: 'string' },
                required_skills: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'title', 'description', 'company'],
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
                  match_percentage: { type: 'integer' },
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
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const validation = jobMatchBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const body = validation.data;
    app.logger.info({ userId: session.user.id, jobCount: body.jobs.length }, 'Analyzing job matches');

    try {
      const jobsJson = body.jobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        required_skills: job.required_skills || [],
      }));

      const prompt = `Analyze how well this CV matches each of the provided jobs. For each job, return a JSON object with:
- job_id: the job ID
- match_percentage: 0-100 integer
- matched_skills: array of skills found in both CV and job
- missing_skills: array of required skills in job not found in CV
- recommendation: 1-2 sentence advice for the candidate

CV:
${body.cv_text}

Jobs to analyze (JSON):
${JSON.stringify(jobsJson, null, 2)}

Return ONLY a JSON array of match objects, no other text. Example format:
[
  {
    "job_id": "job1",
    "match_percentage": 85,
    "matched_skills": ["React", "TypeScript"],
    "missing_skills": ["Docker"],
    "recommendation": "Strong match. Consider adding Docker to your skillset."
  }
]`;

      const { object } = await generateObject({
        model: gateway('openai/gpt-4o'),
        schema: jobMatchResponseSchema,
        schemaName: 'JobMatches',
        schemaDescription: 'CV match analysis against multiple jobs',
        prompt,
      });

      app.logger.info({ userId: session.user.id, jobCount: object.matches.length }, 'Job matches analyzed successfully');
      return object;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to analyze job matches');
      return reply.status(500).send({ error: 'Failed to analyze job matches' });
    }
  });

  // POST /api/cv/score
  fastify.post('/api/cv/score', {
    schema: {
      description: 'Score and analyze a CV with detailed insights using GPT-4o',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['cv_text'],
        properties: {
          cv_text: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            score: { type: 'integer' },
            industry_fit: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
            section_scores: {
              type: 'object',
              properties: {
                summary: { type: 'integer' },
                experience: { type: 'integer' },
                education: { type: 'integer' },
                skills: { type: 'integer' },
                formatting: { type: 'integer' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cv_text: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text } = request.body;

    if (!cv_text || cv_text.trim().length === 0) {
      return reply.status(400).send({ error: 'cv_text is required and cannot be empty' });
    }

    app.logger.info({ userId: session.user.id, cvLength: cv_text.length }, 'Processing CV score request');

    try {
      // Analyze CV with AI
      app.logger.info({ userId: session.user.id }, 'Analyzing CV with AI for comprehensive scoring');

      const prompt = `Analyze this CV and rate it 0-100. Extract top skills. Identify 2-3 strengths and weaknesses. Suggest 2-3 improvements. Rate each section.

CV: ${cv_text.substring(0, 1000)}

Return ONLY valid JSON matching this schema:
{"score": 75, "industry_fit": "Technology", "skills": ["JavaScript"], "summary": "Assessment here", "strengths": ["Strength 1"], "weaknesses": ["Weakness 1"], "improvements": ["Improvement 1"], "section_scores": {"summary": 70, "experience": 80, "education": 80, "skills": 90, "formatting": 75}}`;

      try {
        const { object } = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: cvScoreResponseSchema,
          schemaName: 'CVScore',
          schemaDescription: 'Detailed CV analysis and scoring',
          prompt,
        });

        // Update profile with score and industry fit if authenticated
        if (session?.user?.id) {
          try {
            await app.db.update(schema.profiles)
              .set({
                cvScore: object.score,
                industryFit: JSON.stringify({ industry: object.industry_fit, score: object.score, reasoning: object.summary }),
                updatedAt: new Date(),
              })
              .where(eq(schema.profiles.userId, session.user.id));

            app.logger.info({ userId: session.user.id, cvScore: object.score }, 'Profile updated with CV score');
          } catch (updateError) {
            app.logger.warn({ err: updateError, userId: session.user.id }, 'Failed to update profile with CV score');
          }
        }

        app.logger.info({ userId: session.user.id, score: object.score }, 'CV scored successfully');
        return object;
      } catch (aiError) {
        app.logger.error({ err: aiError, userId: session.user.id }, 'AI analysis failed');
        return reply.status(500).send({ error: 'Failed to analyze CV with AI' });
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to score CV');
      return reply.status(500).send({ error: 'Failed to process request' });
    }
  });
}
