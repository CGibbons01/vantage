import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRequire } from 'module';
import { gateway } from '@specific-dev/framework';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import mammoth from 'mammoth';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
  const requireAuth = createBearerAuth(app);

  // POST /api/cv/generate
  fastify.post('/api/cv/generate', {
    schema: {
      description: 'Generate a professional CV based on basic details',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        properties: {
          job_title: { type: 'string' },
          industry: { type: 'string' },
          years_experience: { type: 'number' },
          skills: { type: 'array', items: { type: 'string' } },
          tone: { type: 'string', enum: ['professional', 'creative', 'academic'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            cv_text: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { job_title?: string; industry?: string; years_experience?: number; skills?: string[]; tone?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { job_title, industry, years_experience, skills, tone = 'professional' } = request.body;

    app.logger.info({ userId: session.user.id, jobTitle: job_title }, 'Generating CV');

    try {
      const skillsText = skills && skills.length > 0 ? skills.join(', ') : 'Not specified';
      const experienceText = years_experience ? `${years_experience} years of experience` : 'Experience level not specified';
      const industryText = industry ? `in the ${industry} industry` : '';

      const toneDescriptions = {
        professional: 'formal and professional tone',
        creative: 'creative and engaging tone',
        academic: 'academic and detailed tone',
      };

      const prompt = `Generate a professional CV in plain text format for a candidate with the following profile:

Job Title/Target Role: ${job_title || 'Not specified'}
Industry: ${industry || 'Not specified'}
Experience: ${experienceText}
Key Skills: ${skillsText}
Tone: ${toneDescriptions[tone as keyof typeof toneDescriptions] || 'professional'}

Create a realistic, well-structured CV with appropriate sections. Make it suitable for ATS systems. Return only the CV content in plain text format, no markdown.`;

      const { text: cvText } = await generateText({
        model: gateway('openai/gpt-4o-mini'),
        prompt,
      });

      app.logger.info({ userId: session.user.id }, 'CV generated successfully');
      return {
        cv_text: cvText,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate CV');
      return reply.status(500).send({ error: 'Failed to generate CV' });
    }
  });

  // POST /api/cv/improve
  fastify.post('/api/cv/improve', {
    schema: {
      description: 'Improve an existing CV',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['cv_text'],
        properties: {
          cv_text: { type: 'string' },
          job_description: { type: 'string' },
          focus_areas: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            improved_cv: { type: 'string' },
            changes_made: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cv_text: string; job_description?: string; focus_areas?: string[] } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text, job_description, focus_areas } = request.body;

    if (!cv_text) {
      return reply.status(400).send({ error: 'cv_text is required' });
    }

    app.logger.info({ userId: session.user.id }, 'Improving CV');

    try {
      const focusGuidance = focus_areas && focus_areas.length > 0
        ? `Focus on: ${focus_areas.join(', ')}`
        : 'Focus on all areas of improvement';

      const jobContext = job_description
        ? `Target Job Description:\n${job_description}\n\n`
        : '';

      const prompt = `You are an expert CV reviewer. Improve the following CV${job_description ? ' to match the job description' : ''}.

${jobContext}${focusGuidance}

Current CV:
${cv_text}

Improve the CV with:
- Stronger action verbs and impact statements
- Quantifiable achievements and metrics
- Relevant keywords
- Better formatting and readability

Return a JSON object with:
- improved_cv: the improved CV text (plain text)
- changes_made: array of specific changes and improvements made`;

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
          improved_cv: cv_text,
          changes_made: ['Review CV structure', 'Add quantifiable achievements', 'Enhance keyword presence'],
        };
      }

      app.logger.info({ userId: session.user.id }, 'CV improved successfully');
      return {
        improved_cv: parsedResponse.improved_cv || cv_text,
        changes_made: parsedResponse.changes_made || [],
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to improve CV');
      return reply.status(500).send({ error: 'Failed to improve CV' });
    }
  });

  // POST /api/cover-letter/generate
  fastify.post('/api/cover-letter/generate', {
    schema: {
      description: 'Generate a professional cover letter',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['job_title', 'company'],
        properties: {
          job_title: { type: 'string' },
          company: { type: 'string' },
          job_description: { type: 'string' },
          cv_text: { type: 'string' },
          tone: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            cover_letter: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { job_title: string; company: string; job_description?: string; cv_text?: string; tone?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { job_title, company, job_description, cv_text, tone = 'professional' } = request.body;

    if (!job_title || !company) {
      return reply.status(400).send({ error: 'job_title and company are required' });
    }

    app.logger.info({ userId: session.user.id, company, jobTitle: job_title }, 'Generating cover letter');

    try {
      const jobContext = job_description ? `Job Description:\n${job_description}\n\n` : '';
      const cvContext = cv_text ? `Candidate Background:\n${cv_text}\n\n` : '';

      const prompt = `Write a professional cover letter for the position of ${job_title} at ${company}.

${jobContext}${cvContext}Tone: ${tone}

Generate a well-structured cover letter that is 3-4 paragraphs long and suitable for submission.`;

      const { text: coverLetterText } = await generateText({
        model: gateway('openai/gpt-4o-mini'),
        prompt,
      });

      app.logger.info({ userId: session.user.id }, 'Cover letter generated successfully');
      return { cover_letter: coverLetterText };
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
      description: 'Score a CV using AI analysis and save results to profile',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['file_base64', 'file_name'],
        properties: {
          file_base64: { type: 'string', description: 'Base64-encoded file content' },
          file_name: { type: 'string', description: 'Original filename' },
          mime_type: { type: 'string', description: 'MIME type of the file (optional)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            overall_score: { type: 'number', minimum: 0, maximum: 100 },
            industry_scores: { type: 'object' },
            improvement_tips: { type: 'array', items: { type: 'string' } },
            industry_fit: { type: 'string' },
            summary: { type: 'string' },
            cv_text: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { file_base64: string; file_name: string; mime_type?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { file_base64, file_name, mime_type } = request.body;

    app.logger.info({ userId: session.user.id, fileName: file_name }, 'CV score request received');

    try {
      // Validate required fields
      if (!file_base64 || !file_name) {
        app.logger.warn({ userId: session.user.id }, 'Missing required fields in request body');
        return reply.status(400).send({ error: 'Missing required fields: file_base64, file_name' });
      }

      // Infer MIME type from filename if not provided
      let detectedMimeType = mime_type;
      if (!detectedMimeType) {
        if (file_name.toLowerCase().endsWith('.pdf')) {
          detectedMimeType = 'application/pdf';
        } else if (file_name.toLowerCase().endsWith('.docx')) {
          detectedMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (file_name.toLowerCase().endsWith('.txt')) {
          detectedMimeType = 'text/plain';
        }
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

      // Extract text from file based on detected MIME type
      let cvText = '';
      try {
        if (detectedMimeType === 'application/pdf' || file_name.toLowerCase().endsWith('.pdf')) {
          app.logger.debug({ userId: session.user.id }, 'Extracting text from PDF');
          try {
            const data = await pdfParse(fileBuffer);
            cvText = data.text || '';
          } catch (pdfError) {
            app.logger.warn({ err: pdfError }, 'PDF parsing failed, falling back to UTF-8');
            cvText = fileBuffer.toString('utf-8');
          }
        } else if (
          detectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
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
        } else if (detectedMimeType === 'text/plain' || file_name.toLowerCase().endsWith('.txt')) {
          app.logger.debug({ userId: session.user.id }, 'Decoding plain text file');
          cvText = fileBuffer.toString('utf-8');
        } else {
          app.logger.warn({ userId: session.user.id, mimeType: detectedMimeType }, 'Unsupported file type');
          return reply.status(400).send({ error: 'Unsupported file type' });
        }
      } catch (extractError) {
        app.logger.error({ err: extractError, fileName: file_name }, 'Text extraction failed');
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
- overall_score: integer 0-100 representing overall CV quality
- industry_scores: object with keys like "Technology", "Finance", "Marketing", "Healthcare", "Sales" each with integer values 0-100
- improvement_tips: array of 5-8 actionable strings for CV improvement
- industry_fit: string naming the best fitting industry
- summary: string with 2-3 sentence overall assessment

CV Text:
${truncatedCvText}`;

      const cvScoreSchema = z.object({
        overall_score: z.number().int().min(0).max(100),
        industry_scores: z.record(z.string(), z.number().int().min(0).max(100)),
        improvement_tips: z.array(z.string()),
        industry_fit: z.string(),
        summary: z.string(),
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
        app.logger.debug({ score: scoreData.overall_score }, 'generateObject returned successfully');
      } catch (genError) {
        app.logger.error({ err: genError, genErrorMsg: genError instanceof Error ? genError.message : String(genError) }, 'generateObject failed for CV scoring');
        return reply.status(500).send({ error: 'Failed to analyze CV with AI' });
      }

      // Save results to profiles table
      try {
        await app.db.insert(schema.profiles)
          .values({
            userId: session.user.id,
            cvText: truncatedCvText,
            cvFilename: file_name,
            cvScore: scoreData.overall_score,
            overallScore: scoreData.overall_score,
            industryScores: JSON.stringify(scoreData.industry_scores),
            improvementTips: JSON.stringify(scoreData.improvement_tips),
            industryFit: scoreData.industry_fit,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.profiles.userId,
            set: {
              cvText: truncatedCvText,
              cvFilename: file_name,
              cvScore: scoreData.overall_score,
              overallScore: scoreData.overall_score,
              industryScores: JSON.stringify(scoreData.industry_scores),
              improvementTips: JSON.stringify(scoreData.improvement_tips),
              industryFit: scoreData.industry_fit,
              updatedAt: new Date(),
            },
          });
        app.logger.info({ userId: session.user.id }, 'CV scoring saved to profiles');
      } catch (dbError) {
        app.logger.warn({ err: dbError }, 'Failed to save CV scoring to profiles, continuing anyway');
      }

      app.logger.info({ userId: session.user.id, score: scoreData.overall_score }, 'CV scored successfully');

      return {
        overall_score: scoreData.overall_score,
        industry_scores: scoreData.industry_scores,
        improvement_tips: scoreData.improvement_tips,
        industry_fit: scoreData.industry_fit,
        summary: scoreData.summary,
        cv_text: cvText.substring(0, 500),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to score CV');
      return reply.status(500).send({ error: 'Failed to score CV' });
    }
  });

  // POST /api/cv/export-pdf
  fastify.post('/api/cv/export-pdf', {
    schema: {
      description: 'Export CV content as base64-encoded HTML',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['cv_text'],
        properties: {
          cv_text: { type: 'string' },
          template: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            file_base64: { type: 'string' },
            filename: { type: 'string' },
            content_type: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cv_text: string; template?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text } = request.body;

    if (!cv_text) {
      return reply.status(400).send({ error: 'cv_text is required' });
    }

    try {
      app.logger.info({ userId: session.user.id }, 'Exporting CV as HTML');

      // Generate simple HTML representation of the CV
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    p { margin: 5px 0; }
    .section { margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="section">
    ${cv_text.split('\n').map(line => {
      if (line.trim() === '') return '<br>';
      if (line.toUpperCase() === line && line.trim().length > 0) return `<h2>${line}</h2>`;
      if (line.trim().endsWith(':')) return `<h3>${line}</h3>`;
      return `<p>${line}</p>`;
    }).join('\n')}
  </div>
</body>
</html>`;

      const base64Content = Buffer.from(htmlContent).toString('base64');

      app.logger.info({ userId: session.user.id }, 'CV exported as HTML successfully');

      return {
        file_base64: base64Content,
        filename: 'cv.html',
        content_type: 'text/html',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export CV as HTML');
      return reply.status(500).send({ error: 'Failed to export CV' });
    }
  });

  // POST /api/cover-letter/export-pdf
  fastify.post('/api/cover-letter/export-pdf', {
    schema: {
      description: 'Export cover letter as base64-encoded HTML',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['cover_letter'],
        properties: {
          cover_letter: { type: 'string' },
          job_title: { type: 'string' },
          company: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            file_base64: { type: 'string' },
            filename: { type: 'string' },
            content_type: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cover_letter: string; job_title?: string; company?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cover_letter, job_title, company } = request.body;

    if (!cover_letter) {
      return reply.status(400).send({ error: 'cover_letter is required' });
    }

    try {
      app.logger.info({ userId: session.user.id }, 'Exporting cover letter as HTML');

      // Generate HTML representation of the cover letter
      const title = job_title && company ? `${job_title} at ${company}` : 'Cover Letter';
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { text-align: center; color: #333; font-size: 24px; margin-bottom: 30px; }
    p { margin: 15px 0; text-align: justify; }
    .signature { margin-top: 30px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">
    ${cover_letter.split('\n\n').map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('\n')}
  </div>
</body>
</html>`;

      const base64Content = Buffer.from(htmlContent).toString('base64');

      app.logger.info({ userId: session.user.id }, 'Cover letter exported as HTML successfully');

      return {
        file_base64: base64Content,
        filename: 'cover-letter.html',
        content_type: 'text/html',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export cover letter as HTML');
      return reply.status(500).send({ error: 'Failed to export cover letter' });
    }
  });

  // POST /api/cv/parse
  fastify.post('/api/cv/parse', {
    schema: {
      description: 'Parse a CV file and extract structured data',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['file_base64'],
        properties: {
          file_base64: { type: 'string' },
          filename: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            headline: { type: 'string' },
            summary: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { file_base64: string; filename?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { file_base64, filename } = request.body;

    if (!file_base64) {
      return reply.status(400).send({ error: 'file_base64 is required' });
    }

    app.logger.info({ userId: session.user.id, filename }, 'CV parse request received');

    try {
      // Decode base64 to buffer
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(file_base64, 'base64');
      } catch (err) {
        app.logger.warn({ err }, 'Failed to decode base64');
        return reply.status(400).send({ error: 'Invalid base64 encoding' });
      }

      // Extract text from file
      let cvText = '';
      try {
        if (filename?.toLowerCase().endsWith('.pdf')) {
          app.logger.debug({ userId: session.user.id }, 'Extracting text from PDF');
          try {
            const data = await pdfParse(fileBuffer);
            cvText = data.text || '';
          } catch (pdfErr) {
            app.logger.warn({ err: pdfErr }, 'PDF parsing failed, falling back to UTF-8');
            cvText = fileBuffer.toString('utf-8');
          }
        } else if (filename?.toLowerCase().endsWith('.docx')) {
          app.logger.debug({ userId: session.user.id }, 'Extracting text from DOCX');
          try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            cvText = result.value || '';
          } catch (docxErr) {
            app.logger.warn({ err: docxErr }, 'DOCX parsing failed, falling back to UTF-8');
            cvText = fileBuffer.toString('utf-8');
          }
        } else {
          cvText = fileBuffer.toString('utf-8');
        }
      } catch (err) {
        app.logger.error({ err }, 'Text extraction failed');
        return reply.status(400).send({ error: 'Failed to extract text from file' });
      }

      if (!cvText || cvText.trim().length === 0) {
        app.logger.warn({ userId: session.user.id }, 'No text extracted from CV');
        return reply.status(400).send({ error: 'Could not extract text from file' });
      }

      // Parse CV text using AI
      const parseSchema = z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        headline: z.string().optional(),
        summary: z.string().optional(),
        skills: z.array(z.string()).optional(),
        experience: z.array(z.object({
          title: z.string().optional(),
          company: z.string().optional(),
          duration: z.string().optional(),
          description: z.string().optional(),
        })).optional(),
        education: z.array(z.object({
          degree: z.string().optional(),
          institution: z.string().optional(),
          year: z.string().optional(),
        })).optional(),
      });

      app.logger.debug({ userId: session.user.id }, 'Parsing CV with AI');
      try {
        const result = await generateObject({
          model: gateway('openai/gpt-4o-mini'),
          schema: parseSchema,
          prompt: `Extract information from this CV:\n\n${cvText}\n\nReturn JSON with: name, email, phone, headline, summary, skills (array), experience (array with title, company, duration, description), education (array with degree, institution, year).`,
        });

        const parsed = result.object;
        app.logger.info({ userId: session.user.id, name: parsed.name }, 'CV parsed successfully');

        return {
          name: parsed.name || '',
          email: parsed.email || '',
          phone: parsed.phone || '',
          headline: parsed.headline || '',
          summary: parsed.summary || '',
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          experience: Array.isArray(parsed.experience) ? parsed.experience : [],
          education: Array.isArray(parsed.education) ? parsed.education : [],
        };
      } catch (aiErr) {
        app.logger.error({ err: aiErr }, 'AI parsing failed');
        return reply.status(500).send({ error: 'Failed to parse CV with AI' });
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to parse CV');
      return reply.status(500).send({ error: 'Failed to parse CV' });
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
