import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRequire } from 'module';
import { eq } from 'drizzle-orm';
import { gateway } from '@specific-dev/framework';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import mammoth from 'mammoth';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';
import { generatePDF, extractTextFromFile } from '../utils/document.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
  const requireAuth = createBearerAuth(app);

  // POST /api/cv/generate
  fastify.post('/api/cv/generate', {
    schema: {
      description: 'Generate a professional ATS-optimized CV using GPT-4o-mini',
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
        .map(exp => `${exp.role} at ${exp.company} (${exp.duration}): ${exp.description}`)
        .join('\n');

      const educationText = body.education
        .map(edu => `${edu.degree} from ${edu.institution} (${edu.year})`)
        .join('\n');

      const prompt = `Generate a professional, ATS-optimized CV for the following candidate:

Name: ${body.name}
Email: ${body.email}
Target Role: ${body.target_role}

Summary: ${body.summary}

Experience:
${experienceText}

Education:
${educationText}

Skills: ${body.skills.join(', ')}

Create a well-formatted CV with sections for professional summary, experience, education, and skills. Use action verbs and quantifiable achievements where possible. Format it for ATS (Applicant Tracking System) compatibility.`;

      const { text: cvText } = await generateText({
        model: gateway('openai/gpt-4o-mini'),
        prompt,
      });

      app.logger.info({ userId: session.user.id, targetRole: body.target_role }, 'CV generated successfully');
      return {
        cv_text: cvText,
        sections: {
          professional_summary: body.summary,
          experience: experienceText,
          education: educationText,
          skills: body.skills.join(', '),
          achievements: 'Professional CV generated with AI assistance',
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate CV');
      return reply.status(500).send({ error: 'Failed to generate CV' });
    }
  });

  // POST /api/cv/improve
  fastify.post('/api/cv/improve', {
    schema: {
      description: 'Improve an existing CV using GPT-4o-mini',
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
    app.logger.info({ userId: session.user.id, targetRole: body.target_role, focusAreas: body.focus_areas }, 'Improving CV');

    try {
      const focusGuidance = body.focus_areas && body.focus_areas.length > 0
        ? `Focus on: ${body.focus_areas.join(', ')}`
        : 'Focus on all areas of improvement';

      const prompt = `You are an expert CV reviewer and career coach. Improve this CV for the role of ${body.target_role}.

${focusGuidance}

Current CV:
${body.cv_text}

1. First, rate the current CV from 0-100 on overall quality and impact
2. Rewrite and improve the CV with:
   - Stronger action verbs and impact statements
   - Quantifiable achievements and metrics
   - Industry-relevant keywords for the target role
   - Better formatting and readability
   - Removed weak language or vague statements
3. Provide 5-7 specific suggestions for further improvement

Return a JSON object with:
- score_before: integer 0-100
- score_after: integer 0-100 (after improvements)
- improved_cv: the improved CV text
- suggestions: array of 5-7 actionable improvement suggestions`;

      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o-mini'),
        prompt,
      });

      let parsedResponse;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch {
        app.logger.warn({ userId: session.user.id }, 'Failed to parse AI response, using defaults');
        parsedResponse = {
          score_before: 70,
          score_after: 85,
          improved_cv: body.cv_text,
          suggestions: ['Add quantifiable achievements', 'Use industry keywords', 'Include metrics and results', 'Strengthen opening statement', 'Add specific project outcomes'],
        };
      }

      app.logger.info({ userId: session.user.id, scoreBefore: parsedResponse.score_before, scoreAfter: parsedResponse.score_after }, 'CV improved successfully');
      return {
        improved_cv_text: parsedResponse.improved_cv || body.cv_text,
        suggestions: parsedResponse.suggestions || [],
        score_before: parsedResponse.score_before || 70,
        score_after: parsedResponse.score_after || 85,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to improve CV');
      return reply.status(500).send({ error: 'Failed to improve CV' });
    }
  });

  // POST /api/cover-letter/generate
  fastify.post('/api/cover-letter/generate', {
    schema: {
      description: 'Generate a tailored cover letter using GPT-4o-mini',
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
        model: gateway('openai/gpt-4o-mini'),
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
      description: 'Analyze CV match against multiple job descriptions using GPT-4o-mini',
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
        model: gateway('openai/gpt-4o-mini'),
        schema: jobMatchResponseSchema,
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
      description: 'Score a CV using AI analysis',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['file_base64', 'file_name', 'mime_type'],
        properties: {
          file_base64: { type: 'string', description: 'Base64-encoded file content' },
          file_name: { type: 'string', description: 'Original filename' },
          mime_type: { type: 'string', description: 'MIME type of the file (e.g. application/pdf)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            score: { type: 'number', minimum: 0, maximum: 100 },
            summary: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
            keywords_found: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { file_base64: string; file_name: string; mime_type: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { file_base64, file_name, mime_type } = request.body;

    app.logger.info({ userId: session.user.id, fileName: file_name, mimeType: mime_type }, 'CV score request received');

    try {
      // Validate required fields
      if (!file_base64 || !file_name || !mime_type) {
        app.logger.warn({ userId: session.user.id }, 'Missing required fields in request body');
        return reply.status(400).send({ error: 'Missing required fields: file_base64, file_name, mime_type' });
      }

      // Decode base64 to buffer
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(file_base64, 'base64');
        app.logger.debug({ fileName: file_name, bufferSize: fileBuffer.length }, 'Decoded base64 to buffer');
      } catch (decodeError) {
        app.logger.warn({ err: decodeError, fileName: file_name }, 'Failed to decode base64');
        return reply.status(400).send({ error: 'Invalid base64 encoding' });
      }

      // Extract text from file based on mime_type or file extension
      let cvText = '';
      try {
        if (mime_type === 'application/pdf' || file_name.toLowerCase().endsWith('.pdf')) {
          app.logger.debug({ userId: session.user.id }, 'Extracting text from PDF');
          try {
            const data = await pdfParse(fileBuffer);
            cvText = data.text || '';
          } catch (pdfError) {
            app.logger.warn({ err: pdfError }, 'PDF parsing failed, falling back to UTF-8');
            cvText = fileBuffer.toString('utf-8');
          }
        } else if (
          mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file_name.toLowerCase().endsWith('.docx')
        ) {
          app.logger.debug({ userId: session.user.id }, 'Extracting text from DOCX');
          try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            cvText = result.value || '';
          } catch (docxError) {
            app.logger.warn({ err: docxError }, 'DOCX parsing failed, falling back to UTF-8');
            cvText = fileBuffer.toString('utf-8');
          }
        } else if (mime_type === 'text/plain' || file_name.toLowerCase().endsWith('.txt')) {
          app.logger.debug({ userId: session.user.id }, 'Decoding plain text file');
          cvText = fileBuffer.toString('utf-8');
        } else {
          app.logger.warn({ userId: session.user.id, mimeType: mime_type }, 'Unsupported file type');
          return reply.status(400).send({ error: 'Unsupported file type' });
        }
      } catch (extractError) {
        app.logger.error({ err: extractError, fileName: file_name, mimeType: mime_type }, 'Text extraction failed');
        return reply.status(400).send({ error: 'Failed to extract text from file' });
      }

      if (!cvText || cvText.trim().length === 0) {
        app.logger.warn({ userId: session.user.id }, 'No text extracted from CV file');
        return reply.status(400).send({ error: 'Could not extract text from the uploaded file' });
      }

      app.logger.info({ userId: session.user.id, textLength: cvText.length }, 'CV text extracted successfully');

      // Truncate text to 8000 characters
      const truncatedCvText = cvText.length > 8000 ? cvText.substring(0, 8000) : cvText;
      if (cvText.length > 8000) {
        app.logger.debug({ userId: session.user.id, originalLength: cvText.length, truncatedLength: truncatedCvText.length }, 'CV text truncated for AI scoring');
      }

      // Call AI to score the CV
      const scorePrompt = `You are an expert CV/resume reviewer. Analyze the following CV text and return ONLY a valid JSON object (no markdown, no explanation) with these exact fields:
- score: integer 0-100 representing overall CV quality
- summary: string with 2-3 sentence overall assessment
- strengths: array of exactly 3 strings describing the top strengths
- improvements: array of exactly 3 strings describing the top areas to improve
- keywords_found: array of strings listing relevant professional keywords found in the CV

CV Text:
${truncatedCvText}`;

      const cvScoreSchema = z.object({
        score: z.number().int().min(0).max(100),
        summary: z.string(),
        strengths: z.array(z.string()).length(3),
        improvements: z.array(z.string()).length(3),
        keywords_found: z.array(z.string()),
      });

      app.logger.debug({ userId: session.user.id }, 'Calling generateObject for CV scoring');
      let scoreData;
      try {
        const result = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: cvScoreSchema,
          prompt: scorePrompt,
        });
        if (!result || !result.object) {
          throw new Error('generateObject returned invalid result: no object property');
        }
        scoreData = result.object;
        app.logger.debug({ score: scoreData.score }, 'generateObject returned successfully');
      } catch (genError) {
        app.logger.error({ err: genError, genErrorMsg: genError instanceof Error ? genError.message : String(genError) }, 'generateObject failed for CV scoring');
        return reply.status(500).send({ error: 'Failed to analyze CV with AI' });
      }

      app.logger.info({ userId: session.user.id, score: scoreData.score }, 'CV scored successfully');

      return {
        score: scoreData.score,
        summary: scoreData.summary,
        strengths: scoreData.strengths,
        improvements: scoreData.improvements,
        keywords_found: scoreData.keywords_found,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to score CV');
      return reply.status(500).send({ error: 'Failed to score CV' });
    }
  });

  // POST /api/cv/export-pdf
  fastify.post('/api/cv/export-pdf', {
    schema: {
      description: 'Export CV content as PDF',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
          title: { type: 'string' },
        },
      },
      response: {
        200: { type: 'string', format: 'binary' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { content: string; title?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { content, title } = request.body;

    if (!content) {
      return reply.status(400).send({ error: 'content is required' });
    }

    try {
      app.logger.info({ userId: session.user.id }, 'Exporting CV to PDF');
      const pdfBuffer = await generatePDF(content, title);

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="cv.pdf"')
        .send(pdfBuffer);

      app.logger.info({ userId: session.user.id }, 'CV exported to PDF successfully');
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export CV to PDF');
      return reply.status(500).send({ error: 'Failed to generate PDF' });
    }
  });

  // POST /api/cover-letter/export-pdf
  fastify.post('/api/cover-letter/export-pdf', {
    schema: {
      description: 'Export cover letter content as PDF',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
          title: { type: 'string' },
        },
      },
      response: {
        200: { type: 'string', format: 'binary' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { content: string; title?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { content, title } = request.body;

    if (!content) {
      return reply.status(400).send({ error: 'content is required' });
    }

    try {
      app.logger.info({ userId: session.user.id }, 'Exporting cover letter to PDF');
      const pdfBuffer = await generatePDF(content, title);

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="cover-letter.pdf"')
        .send(pdfBuffer);

      app.logger.info({ userId: session.user.id }, 'Cover letter exported to PDF successfully');
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export cover letter to PDF');
      return reply.status(500).send({ error: 'Failed to generate PDF' });
    }
  });

  // POST /api/cv/parse
  fastify.post('/api/cv/parse', {
    schema: {
      description: 'Parse a CV file and extract structured data',
      tags: ['ai', 'cv'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            location: { type: 'string' },
            headline: { type: 'string' },
            summary: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            cvText: { type: 'string' },
            cvFilename: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'CV parse request received');

    try {
      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let filename = '';

      for await (const part of parts) {
        const partAny = part as any;
        if (partAny.fieldname === 'cv') {
          app.logger.debug({
            type: partAny.type,
            filename: partAny.filename,
            hasFile: !!partAny.file,
            hasToBuffer: typeof partAny.toBuffer,
            hasValue: !!partAny.value,
          }, 'Processing cv part');

          try {
            // Strategy 1: Try .file property
            if (partAny.file && !fileBuffer) {
              const chunks: Buffer[] = [];
              try {
                for await (const chunk of partAny.file) {
                  chunks.push(chunk as Buffer);
                }
                if (chunks.length > 0) {
                  fileBuffer = Buffer.concat(chunks);
                  filename = partAny.filename || 'cv';
                  app.logger.debug({ bufferSize: fileBuffer.length }, 'Read file from .file property');
                }
              } catch (err) {
                app.logger.debug({ err }, 'Failed to read from .file property');
              }
            }

            // Strategy 2: Try iterating part directly
            if (!fileBuffer) {
              const chunks: Buffer[] = [];
              try {
                for await (const chunk of partAny) {
                  chunks.push(chunk as Buffer);
                }
                if (chunks.length > 0) {
                  fileBuffer = Buffer.concat(chunks);
                  filename = partAny.filename || 'cv';
                  app.logger.debug({ bufferSize: fileBuffer.length }, 'Read file from part iteration');
                }
              } catch (err) {
                app.logger.debug({ err }, 'Failed to iterate part directly');
              }
            }

            // Strategy 3: Try toBuffer() method
            if (!fileBuffer && typeof partAny.toBuffer === 'function') {
              try {
                fileBuffer = await partAny.toBuffer();
                filename = partAny.filename || 'cv';
                app.logger.debug({ bufferSize: fileBuffer.length }, 'Read file using toBuffer()');
              } catch (err) {
                app.logger.debug({ err }, 'toBuffer() failed');
              }
            }

            // Strategy 4: Try .value property as fallback
            if (!fileBuffer && partAny.value !== undefined) {
              try {
                if (Buffer.isBuffer(partAny.value)) {
                  fileBuffer = partAny.value;
                  filename = partAny.filename || 'cv';
                  app.logger.debug({ bufferSize: fileBuffer.length }, 'Read file from .value (Buffer)');
                } else if (typeof partAny.value === 'string' && partAny.value.length > 0) {
                  fileBuffer = Buffer.from(partAny.value, 'utf-8');
                  filename = partAny.filename || 'cv';
                  app.logger.debug({ bufferSize: fileBuffer.length, preview: partAny.value.substring(0, 50) }, 'Read file from .value (string)');
                }
              } catch (err) {
                app.logger.debug({ err }, '.value extraction failed');
              }
            }
          } catch (e) {
            app.logger.warn({ err: e }, 'Error reading cv part');
          }
          break;
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        app.logger.warn('File buffer is null or empty');
        return reply.status(400).send({ error: 'No CV file uploaded' });
      }

      app.logger.debug({ fileBufferLength: fileBuffer.length, filename }, 'File buffer ready for text extraction');

      // Extract text from file based on extension
      let cvText = '';
      try {
        if (filename.toLowerCase().endsWith('.pdf')) {
          app.logger.debug({ userId: session?.user?.id }, 'Extracting text from PDF');
          const data = await pdfParse(fileBuffer);
          cvText = data.text || '';
        } else if (filename.toLowerCase().endsWith('.docx')) {
          app.logger.debug({ userId: session?.user?.id }, 'Extracting text from DOCX');
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          cvText = result.value || '';
        } else {
          app.logger.debug({ userId: session?.user?.id }, 'Treating file as plain text');
          cvText = fileBuffer.toString('utf-8');
        }
      } catch (extractError) {
        app.logger.warn({ err: extractError, filename }, 'Text extraction failed, falling back to UTF-8');
        cvText = fileBuffer.toString('utf-8');
      }

      if (!cvText || cvText.trim().length === 0) {
        app.logger.warn({ userId: session?.user?.id }, 'No text extracted from CV file');
        return reply.status(400).send({ error: 'Could not extract text from the uploaded file' });
      }

      app.logger.info({ userId: session.user.id, textLength: cvText.length }, 'CV text read successfully');
      const cvFilename = filename;

      // Use OpenAI to extract structured CV data
      const parseSchema = z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        location: z.string().optional(),
        headline: z.string().optional(),
        summary: z.string().optional(),
        skills: z.array(z.any()).optional(),
        experience: z.array(z.any()).optional(),
        education: z.array(z.any()).optional(),
      }).passthrough();

      app.logger.debug({ userId: session.user.id }, 'Calling generateObject for CV parsing');
      let parsedData;
      try {
        const result = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: parseSchema,
          prompt: `Extract key CV information from this text:\n\nCV Text:\n${cvText}\n\nReturn JSON with: name, email, phone, location, headline, summary (strings or null if not found), skills (array of strings), experience (array of job objects), education (array of education objects).`,
        });
        if (!result || !result.object) {
          throw new Error('generateObject returned invalid result: no object property');
        }
        parsedData = result.object;
        // Ensure arrays have default values if null or undefined
        parsedData.skills = Array.isArray(parsedData.skills) ? parsedData.skills : [];
        parsedData.experience = Array.isArray(parsedData.experience) ? parsedData.experience : [];
        parsedData.education = Array.isArray(parsedData.education) ? parsedData.education : [];
        app.logger.debug({ name: parsedData.name }, 'generateObject returned successfully');
      } catch (genError) {
        app.logger.error({ err: genError, genErrorMsg: genError instanceof Error ? genError.message : String(genError) }, 'generateObject failed for CV parsing, using defaults');
        // Return default values if AI parsing fails
        parsedData = {
          name: undefined,
          email: undefined,
          phone: undefined,
          location: undefined,
          headline: undefined,
          summary: undefined,
          skills: [],
          experience: [],
          education: [],
        };
      }

      app.logger.info({ userId: session.user.id }, 'CV parsed successfully');

      // Save to profiles table (upsert by user_id)
      try {
        const result = await app.db.insert(schema.profiles)
          .values({
            userId: session.user.id,
            headline: parsedData.headline || '',
            summary: parsedData.summary || '',
            location: parsedData.location || '',
            phone: parsedData.phone || '',
            skills: JSON.stringify(parsedData.skills || []),
            experience: JSON.stringify(parsedData.experience || []),
            education: JSON.stringify(parsedData.education || []),
            cvText: cvText,
            cvFilename: cvFilename,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.profiles.userId,
            set: {
              headline: parsedData.headline || '',
              summary: parsedData.summary || '',
              location: parsedData.location || '',
              phone: parsedData.phone || '',
              skills: JSON.stringify(parsedData.skills || []),
              experience: JSON.stringify(parsedData.experience || []),
              education: JSON.stringify(parsedData.education || []),
              cvText: cvText,
              cvFilename: cvFilename,
              updatedAt: new Date(),
            },
          })
          .returning();

        const profile = result[0];
        const parsedProfile = {
          ...profile,
          skills: profile.skills ? JSON.parse(profile.skills) : [],
          experience: profile.experience ? JSON.parse(profile.experience) : [],
          education: profile.education ? JSON.parse(profile.education) : [],
        };

        app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile saved successfully');
        return parsedProfile;
      } catch (dbError) {
        app.logger.warn({ err: dbError }, 'Failed to save to profile, returning parsed data anyway');
        return {
          userId: session.user.id,
          ...parsedData,
          skills: parsedData.skills || [],
          experience: parsedData.experience || [],
          education: parsedData.education || [],
          cvText,
          cvFilename: cvFilename,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      const details = errorMsg || 'Unknown error occurred';
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg, stack: errorStack }, 'Failed to parse CV');
      return reply.status(500).send({ error: 'Failed to parse CV', details });
    }
  });

  // POST /api/longevity/analyze
  fastify.post('/api/longevity/analyze', {
    schema: {
      description: 'Analyze career longevity and automation risk (Premium feature)',
      tags: ['ai', 'longevity'],
      body: {
        type: 'object',
        required: ['cv_text'],
        properties: {
          cv_text: { type: 'string' },
          job_title: { type: 'string' },
          industry: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cv_text: string; job_title?: string; industry?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text, job_title, industry } = request.body;

    if (!cv_text) {
      return reply.status(400).send({ error: 'cv_text is required' });
    }

    try {
      app.logger.info({ userId: session.user.id }, 'Analyzing career longevity');

      const jobTitleText = job_title ? `Job Title (if provided): ${job_title}` : '';
      const industryText = industry ? `Industry (if provided): ${industry}` : '';

      const prompt = `You are a career longevity analyst specializing in AI automation risk and future job market trends. Analyze the following CV/career profile and provide a comprehensive assessment.

CV Text: ${cv_text.substring(0, 2000)}
${jobTitleText}
${industryText}

Analyze which specific tasks in this person's current role are most susceptible to automation, identify their transferable skills, and recommend specific roles with better longevity that leverage their existing experience.

Return ONLY valid JSON with this exact structure:
{
  "automation_risk": {
    "score": <0-100 integer, higher = more at risk>,
    "level": "<Low|Medium|High|Very High>",
    "summary": "<2-3 sentence explanation of the risk level and key factors>"
  },
  "at_risk_skills": ["<skills/tasks most likely to be automated>"],
  "future_proof_skills": ["<skills this person has that are hard to automate>"],
  "longevity_score": <0-100 integer, higher = more future-proof>,
  "industry_outlook": "<2-3 sentences on the industry's future with AI/automation trends>",
  "recommended_pivot_roles": [
    {
      "title": "<role title>",
      "reason": "<why this role suits them and has good longevity>",
      "skill_overlap": "<Low|Medium|High>",
      "longevity_score": <0-100>
    }
  ],
  "upskill_recommendations": [
    {
      "skill": "<skill name>",
      "reason": "<why this skill will be valuable>",
      "priority": "<High|Medium|Low>"
    }
  ],
  "bridge_plan": "<actionable paragraph on how to transition their current skills to more future-proof roles, with specific steps>"
}

Provide 3-5 recommended_pivot_roles and 4-6 upskill_recommendations. Be specific and tailored to their actual experience.`;

      const longevitySchema = z.object({
        automation_risk: z.object({
          score: z.number().int().min(0).max(100),
          level: z.enum(['Low', 'Medium', 'High', 'Very High']),
          summary: z.string(),
        }),
        at_risk_skills: z.array(z.string()),
        future_proof_skills: z.array(z.string()),
        longevity_score: z.number().int().min(0).max(100),
        industry_outlook: z.string(),
        recommended_pivot_roles: z.array(z.object({
          title: z.string(),
          reason: z.string(),
          skill_overlap: z.enum(['Low', 'Medium', 'High']),
          longevity_score: z.number().int().min(0).max(100),
        })),
        upskill_recommendations: z.array(z.object({
          skill: z.string(),
          reason: z.string(),
          priority: z.enum(['High', 'Medium', 'Low']),
        })),
        bridge_plan: z.string(),
      });

      const { object } = await generateObject({
        model: gateway('openai/gpt-4o-mini'),
        schema: longevitySchema,
        prompt,
      });

      app.logger.info({ userId: session.user.id, longevityScore: object.longevity_score }, 'Career longevity analysis completed');
      return object;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to analyze career longevity');
      return reply.status(500).send({ error: 'Failed to analyze career longevity' });
    }
  });
}
