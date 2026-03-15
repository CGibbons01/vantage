import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { gateway } from '@specific-dev/framework';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
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
      const experienceText = body.experience
        .map(e => `${e.role} at ${e.company} (${e.duration}): ${e.description}`)
        .join('\n');

      const educationText = body.education
        .map(e => `${e.degree} from ${e.institution} (${e.year})`)
        .join('\n');

      const prompt = `Generate a professional ATS-optimized CV for the following candidate:

Name: ${body.name}
Email: ${body.email}
Target Role: ${body.target_role}

Experience:
${experienceText}

Education:
${educationText}

Skills: ${body.skills.join(', ')}

Summary: ${body.summary}

Create a comprehensive CV with the following structure:
1. Professional Summary (2-3 sentences tailored to the target role)
2. Experience (formatted with bullets, quantified achievements)
3. Education (with dates and institutions)
4. Skills (organized by category if applicable)
5. Achievements (key accomplishments or certifications)

Provide both a full plain-text CV and the sections as separate fields. Make it ATS-friendly with clear keywords and proper formatting.`;

      const { object } = await generateObject({
        model: gateway('openai/gpt-4o'),
        schema: cvGenerateResponseSchema,
        schemaName: 'CVGeneration',
        schemaDescription: 'Generated professional CV with sections',
        prompt,
      });

      app.logger.info({ userId: session.user.id }, 'CV generated successfully');
      return object;
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
      const focusAreas = body.focus_areas?.length ? body.focus_areas.join(', ') : 'all aspects';

      const prompt = `Analyze and improve this CV for a ${body.target_role} position. Focus on: ${focusAreas}

Original CV:
${body.cv_text}

Please:
1. Score the original CV from 0-100 based on effectiveness for the target role
2. Rewrite the CV with:
   - Stronger impact statements with quantifiable achievements
   - Better ATS keywords relevant to ${body.target_role}
   - More compelling language
   - Improved formatting and structure
3. Score the improved CV from 0-100
4. Provide 3-5 specific suggestions for further improvement

Return the improved CV text and suggestions.`;

      const { object } = await generateObject({
        model: gateway('openai/gpt-4o-mini'),
        schema: cvImproveResponseSchema,
        schemaName: 'CVImprovement',
        schemaDescription: 'Improved CV with suggestions and scores',
        prompt,
      });

      app.logger.info({ userId: session.user.id, scoreBefore: object.score_before, scoreAfter: object.score_after }, 'CV improved successfully');
      return object;
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
}
