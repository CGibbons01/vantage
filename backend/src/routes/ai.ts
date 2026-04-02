import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRequire } from 'module';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Zod Schemas
const cvGenerateSchema = z.object({
  cv_text: z.string(),
  sections: z.object({
    professional_summary: z.string(),
    experience: z.string(),
    education: z.string(),
    skills: z.string(),
    achievements: z.string(),
  }),
  score: z.number().min(0).max(100),
});

const cvImproveSchema = z.object({
  improved_cv_text: z.string(),
  suggestions: z.array(z.string()),
  score_before: z.number().min(0).max(100),
  score_after: z.number().min(0).max(100),
});

const cvParseSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  job_title: z.string(),
  skills: z.array(z.string()),
  summary: z.string(),
});

const coverLetterSchema = z.object({
  cover_letter: z.string(),
  word_count: z.number(),
});

// Request interfaces
interface GenerateCVBody {
  name: string;
  email: string;
  target_role: string;
  experience?: Array<{ title: string; company: string; duration: string; description: string }>;
  education?: Array<{ degree: string; institution: string; year: string }>;
  skills?: string[];
  summary?: string;
}

interface ImproveCVBody {
  cv_text: string;
  target_role: string;
  focus_areas?: string[];
}

interface ExportPDFBody {
  content: string;
  title: string;
}

interface GenerateCoverLetterBody {
  applicant_name: string;
  job_title: string;
  company_name: string;
  job_description: string;
  cv_summary: string;
  tone: 'professional' | 'enthusiastic' | 'concise';
}

export function registerAIRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = createBearerAuth(app);

  // POST /api/cv/generate
  fastify.post('/api/cv/generate', {
    schema: {
      description: 'Generate a professional CV using AI',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['name', 'email', 'target_role'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          target_role: { type: 'string' },
          experience: { type: 'array' },
          education: { type: 'array' },
          skills: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            cv_text: { type: 'string' },
            sections: { type: 'object' },
            score: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: GenerateCVBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { name, email, target_role, experience = [], education = [], skills = [], summary = '' } = request.body;

    if (!name || !email || !target_role) {
      return reply.status(400).send({ error: 'name, email, and target_role are required' });
    }

    app.logger.info({ userId: session.user.id, name, target_role }, 'Generating CV');

    try {
      const { text } = await generateText({
        model: gateway('google/gemini-3-flash'),
        prompt: `You are an expert CV writer. Create a professional, ATS-optimised CV for a ${target_role} role for ${name}. Use strong action verbs, quantify achievements where possible, and ensure the CV is tailored to the target role. Return ONLY a valid JSON object with structure: {"cv_text":"string","sections":{"professional_summary":"string","experience":"string","education":"string","skills":"string","achievements":"string"},"score":number(0-100)}. Input data: ${JSON.stringify(request.body)}. Return only the JSON, no other text.`,
      });

      app.logger.debug({ textLength: text.length }, 'generateText result');

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const response = JSON.parse(jsonMatch[0]);
      cvGenerateSchema.parse(response);

      // Update profiles table
      const existingProfile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.userId, session.user.id),
      });

      if (existingProfile) {
        await app.db.update(schema.profiles)
          .set({ cvText: response.cv_text, cvScore: response.score, updatedAt: new Date() })
          .where(eq(schema.profiles.userId, session.user.id));
      } else {
        await app.db.insert(schema.profiles).values({
          userId: session.user.id,
          cvText: response.cv_text,
          cvScore: response.score,
          updatedAt: new Date(),
        });
      }

      app.logger.info({ userId: session.user.id, score: response.score }, 'CV generated successfully');
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to generate CV');
      return reply.status(500).send({ error: 'Failed to generate CV', details: errorMsg });
    }
  });

  // POST /api/cv/improve
  fastify.post('/api/cv/improve', {
    schema: {
      description: 'Improve an existing CV using AI',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['cv_text', 'target_role'],
        properties: {
          cv_text: { type: 'string' },
          target_role: { type: 'string' },
          focus_areas: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            improved_cv_text: { type: 'string' },
            suggestions: { type: 'array' },
            score_before: { type: 'number' },
            score_after: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: ImproveCVBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cv_text, target_role, focus_areas = [] } = request.body;

    if (!cv_text || !target_role) {
      return reply.status(400).send({ error: 'cv_text and target_role are required' });
    }

    app.logger.info({ userId: session.user.id, target_role }, 'Improving CV');

    try {
      const { text } = await generateText({
        model: gateway('google/gemini-3-flash'),
        prompt: `You are an expert CV coach. Improve this CV for a ${target_role} role, focusing on: ${focus_areas.join(', ') || 'general improvement'}. Provide specific improvements, a score before and after, and actionable suggestions. Return ONLY a valid JSON object with structure: {"improved_cv_text":"string","suggestions":["string"],"score_before":number,"score_after":number}. CV: ${cv_text}. Return only the JSON, no other text.`,
      });

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const response = JSON.parse(jsonMatch[0]);
      cvImproveSchema.parse(response);

      // Update profiles table
      await app.db.update(schema.profiles)
        .set({ cvText: response.improved_cv_text, cvScore: response.score_after, updatedAt: new Date() })
        .where(eq(schema.profiles.userId, session.user.id));

      app.logger.info({ userId: session.user.id, scoreBefore: response.score_before, scoreAfter: response.score_after }, 'CV improved successfully');
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to improve CV');
      return reply.status(500).send({ error: 'Failed to improve CV', details: errorMsg });
    }
  });

  // POST /api/cv/parse
  fastify.post('/api/cv/parse', {
    schema: {
      description: 'Parse an uploaded CV file',
      tags: ['ai', 'cv'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            parsed: { type: 'object' },
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

    app.logger.info({ userId: session.user.id }, 'Parsing CV file');

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file provided' });
      }

      const filename = data.filename.toLowerCase();
      const buffer = await data.toBuffer();
      let cvText = '';

      // Extract text based on file type
      if (filename.endsWith('.pdf')) {
        try {
          const pdfData = await pdfParse(buffer);
          cvText = pdfData.text || '';
        } catch (err) {
          app.logger.warn({ err }, 'PDF parsing failed');
          cvText = buffer.toString('utf-8');
        }
      } else if (filename.endsWith('.docx')) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          cvText = result.value || '';
        } catch (err) {
          app.logger.warn({ err }, 'DOCX parsing failed');
          cvText = buffer.toString('utf-8');
        }
      } else {
        return reply.status(400).send({ error: 'Unsupported file format. Please upload a PDF or DOCX file.' });
      }

      if (!cvText || cvText.trim().length === 0) {
        return reply.status(400).send({ error: 'Could not extract text from file' });
      }

      // Parse structured data
      const { text: parseText } = await generateText({
        model: gateway('google/gemini-3-flash'),
        prompt: `Extract structured information from this CV text. Return ONLY a valid JSON object with structure: {"name":"string","email":"string","phone":"string","job_title":"string","skills":["string"],"summary":"string"}. CV text: ${cvText}. Return only the JSON, no other text.`,
      });

      // Parse the JSON response
      const jsonMatch = parseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      cvParseSchema.parse(parsed);

      app.logger.info({ userId: session.user.id, name: parsed.name }, 'CV parsed successfully');
      return { text: cvText, parsed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to parse CV');
      return reply.status(500).send({ error: 'Failed to parse CV', details: errorMsg });
    }
  });

  // POST /api/cv/export-pdf
  fastify.post('/api/cv/export-pdf', {
    schema: {
      description: 'Export CV as PDF',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['content', 'title'],
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
  }, async (request: FastifyRequest<{ Body: ExportPDFBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { content, title } = request.body;

    if (!content) {
      return reply.status(400).send({ error: 'content is required' });
    }

    app.logger.info({ userId: session.user.id, title }, 'Exporting CV as PDF');

    try {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      // Add title
      doc.fontSize(24).font('Helvetica-Bold').text(title || 'CV');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Add content
      const lines = content.split('\n');
      doc.fontSize(11).font('Helvetica');
      for (const line of lines) {
        doc.text(line);
      }

      doc.end();

      return new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `attachment; filename="${title || 'cv'}.pdf"`);
          reply.send(pdf);
          app.logger.info({ userId: session.user.id }, 'CV exported as PDF successfully');
          resolve();
        });
        doc.on('error', reject);
      });
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export CV as PDF');
      return reply.status(500).send({ error: 'Failed to export CV as PDF' });
    }
  });

  // POST /api/cover-letter/generate
  fastify.post('/api/cover-letter/generate', {
    schema: {
      description: 'Generate a cover letter using AI',
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
            word_count: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: GenerateCoverLetterBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { applicant_name, job_title, company_name, job_description, cv_summary, tone = 'professional' } = request.body;

    if (!applicant_name || !job_title || !company_name || !job_description || !cv_summary) {
      return reply.status(400).send({ error: 'All fields are required' });
    }

    app.logger.info({ userId: session.user.id, company: company_name, jobTitle: job_title }, 'Generating cover letter');

    try {
      const { text } = await generateText({
        model: gateway('google/gemini-3-flash'),
        prompt: `You are an expert cover letter writer. Write a compelling, personalised cover letter for ${applicant_name} applying for ${job_title} at ${company_name}. Tone: ${tone}. The letter should be 3-4 paragraphs, reference specific details from the job description, and highlight relevant experience from the CV summary. Do NOT use generic phrases like 'I am writing to apply'. Return ONLY a valid JSON object with structure: {"cover_letter":"string","word_count":number}. Job description: ${job_description}. CV summary: ${cv_summary}. Return only the JSON, no other text.`,
      });

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const response = JSON.parse(jsonMatch[0]);
      coverLetterSchema.parse(response);

      // Insert into cover_letters table
      await app.db.insert(schema.coverLetters).values({
        userId: session.user.id,
        jobTitle: job_title,
        companyName: company_name,
        content: response.cover_letter,
        wordCount: response.word_count,
        createdAt: new Date(),
      });

      app.logger.info({ userId: session.user.id, wordCount: response.word_count }, 'Cover letter generated successfully');
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, userId: session.user.id, message: errorMsg }, 'Failed to generate cover letter');
      return reply.status(500).send({ error: 'Failed to generate cover letter', details: errorMsg });
    }
  });

  // POST /api/cover-letter/export-pdf
  fastify.post('/api/cover-letter/export-pdf', {
    schema: {
      description: 'Export cover letter as PDF',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['content', 'title'],
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
  }, async (request: FastifyRequest<{ Body: ExportPDFBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { content, title } = request.body;

    if (!content) {
      return reply.status(400).send({ error: 'content is required' });
    }

    app.logger.info({ userId: session.user.id, title }, 'Exporting cover letter as PDF');

    try {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      // Add title
      doc.fontSize(24).font('Helvetica-Bold').text(title || 'Cover Letter');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Add content
      const lines = content.split('\n');
      doc.fontSize(11).font('Helvetica');
      for (const line of lines) {
        doc.text(line);
      }

      doc.end();

      return new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `attachment; filename="${title || 'cover-letter'}.pdf"`);
          reply.send(pdf);
          app.logger.info({ userId: session.user.id }, 'Cover letter exported as PDF successfully');
          resolve();
        });
        doc.on('error', reject);
      });
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export cover letter as PDF');
      return reply.status(500).send({ error: 'Failed to export cover letter as PDF' });
    }
  });
}
