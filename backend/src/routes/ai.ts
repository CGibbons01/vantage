import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRequire } from 'module';
import { gateway } from '@specific-dev/framework';
import { generateText } from 'ai';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Zod schemas for structured outputs
const cvDataSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  location: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    description: z.string(),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  })),
  certifications: z.array(z.string()),
});

type CVData = z.infer<typeof cvDataSchema>;

export function registerAIRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = createBearerAuth(app);

  // POST /api/cv/parse
  fastify.post('/api/cv/parse', {
    schema: {
      description: 'Parse a CV file and extract structured data',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['file_base64', 'filename'],
        properties: {
          file_base64: { type: 'string' },
          filename: { type: 'string' },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            location: { type: 'string' },
            summary: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            certifications: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { file_base64: string; filename: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { file_base64, filename } = request.body;

    app.logger.info({ userId: session.user.id, filename }, 'Parsing CV file');

    try {
      // Decode base64 to buffer
      let buffer: Buffer;
      try {
        buffer = Buffer.from(file_base64, 'base64');
      } catch (err) {
        app.logger.warn({ err }, 'Failed to decode base64');
        return reply.status(400).send({ error: 'Invalid base64 encoding' });
      }

      // Extract text based on file type
      let cvText = '';
      try {
        if (filename.toLowerCase().endsWith('.pdf')) {
          app.logger.debug({ filename }, 'Extracting text from PDF');
          try {
            const data = await pdfParse(buffer);
            cvText = data.text || '';
          } catch (pdfErr) {
            app.logger.warn({ err: pdfErr }, 'PDF parsing failed, using UTF-8 fallback');
            cvText = buffer.toString('utf-8');
          }
        } else if (filename.toLowerCase().endsWith('.docx')) {
          app.logger.debug({ filename }, 'Extracting text from DOCX');
          try {
            const result = await mammoth.extractRawText({ buffer });
            cvText = result.value || '';
          } catch (docxErr) {
            app.logger.warn({ err: docxErr }, 'DOCX parsing failed, using UTF-8 fallback');
            cvText = buffer.toString('utf-8');
          }
        } else {
          cvText = buffer.toString('utf-8');
        }
      } catch (extractErr) {
        app.logger.error({ err: extractErr, filename }, 'Text extraction failed');
        return reply.status(500).send({ error: 'Failed to extract text from file' });
      }

      if (!cvText || cvText.trim().length === 0) {
        app.logger.warn({ userId: session.user.id }, 'No text extracted from CV');
        return reply.status(400).send({ error: 'Could not extract text from file' });
      }

      // Parse with GPT-4o-mini
      app.logger.debug({ userId: session.user.id }, 'Parsing CV text with AI');
      try {
        const { text: response } = await generateText({
          model: gateway('openai/gpt-4o-mini'),
          prompt: `Extract and structure the following CV text into JSON format with these exact fields:
name (string), email (string), phone (string), location (string), summary (string), skills (array of strings), experience (array of objects with: company, role, startDate, endDate, description), education (array of objects with: institution, degree, field, startDate, endDate), certifications (array of strings).

RETURN ONLY VALID JSON, NO OTHER TEXT.

CV Text:
${cvText}`,
        });

        let parsed;
        try {
          parsed = JSON.parse(response);
        } catch (parseErr) {
          app.logger.warn({ err: parseErr }, 'Failed to parse JSON response, attempting to extract JSON');
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No valid JSON found in response');
          }
        }

        const validated = cvDataSchema.parse(parsed);
        app.logger.info({ userId: session.user.id, name: validated.name }, 'CV parsed successfully');
        return validated;
      } catch (aiErr) {
        app.logger.error({ err: aiErr, userId: session.user.id }, 'AI parsing failed');
        return reply.status(500).send({ error: 'Failed to parse CV with AI' });
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'CV parse endpoint failed');
      return reply.status(500).send({ error: 'Failed to parse CV' });
    }
  });

  // POST /api/cv/generate
  fastify.post('/api/cv/generate', {
    schema: {
      description: 'Generate a professional CV from job details',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['jobTitle', 'industry', 'yearsExperience', 'skills'],
        properties: {
          jobTitle: { type: 'string' },
          industry: { type: 'string' },
          yearsExperience: { type: 'number' },
          skills: { type: 'array', items: { type: 'string' } },
          existingData: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            location: { type: 'string' },
            summary: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            certifications: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { jobTitle: string; industry: string; yearsExperience: number; skills: string[]; existingData?: object } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { jobTitle, industry, yearsExperience, skills, existingData } = request.body;

    app.logger.info({ userId: session.user.id, jobTitle, industry }, 'Generating CV');

    try {
      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt: `You are an expert CV writer. Generate a complete, professional, ATS-optimised CV tailored to the given job title and industry. Return ONLY JSON with these fields: name, email, phone, location, summary, skills (array of strings), experience (array of objects with: company, role, startDate, endDate, description), education (array of objects with: institution, degree, field, startDate, endDate), certifications (array of strings). Make the summary compelling and keyword-rich. Include 3-5 realistic work experience entries appropriate for the years of experience. Include relevant education. Use industry-standard terminology.

Generate a CV for a ${jobTitle} in the ${industry} industry with ${yearsExperience} years of experience. Skills: ${skills.join(', ')}. ${existingData ? 'Existing data to enhance: ' + JSON.stringify(existingData) : ''}

RETURN ONLY VALID JSON, NO OTHER TEXT.`,
      });

      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON in response');
        }
      }

      const validated = cvDataSchema.parse(parsed);
      app.logger.info({ userId: session.user.id, jobTitle }, 'CV generated successfully');
      return validated;
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
        required: ['cvData'],
        properties: {
          cvData: { type: 'object' },
          jobDescription: { type: 'string' },
          targetRole: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            location: { type: 'string' },
            summary: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'array' },
            education: { type: 'array' },
            certifications: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cvData: object; jobDescription?: string; targetRole?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cvData, jobDescription, targetRole } = request.body;

    if (!cvData) {
      return reply.status(400).send({ error: 'cvData is required' });
    }

    app.logger.info({ userId: session.user.id }, 'Improving CV');

    try {
      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt: `You are an expert CV writer and ATS optimisation specialist. Improve the provided CV data by: enhancing language to be more impactful, adding relevant industry keywords, improving ATS score, strengthening the professional summary, quantifying achievements where possible, and tailoring to the target role if provided. Return ONLY JSON in the same schema: name, email, phone, location, summary, skills (array of strings), experience (array of objects with: company, role, startDate, endDate, description), education (array of objects with: institution, degree, field, startDate, endDate), certifications (array of strings).

Improve this CV: ${JSON.stringify(cvData)}. ${targetRole ? 'Target role: ' + targetRole : ''} ${jobDescription ? 'Job description to tailor for: ' + jobDescription : ''}

RETURN ONLY VALID JSON, NO OTHER TEXT.`,
      });

      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON in response');
        }
      }

      const validated = cvDataSchema.parse(parsed);
      app.logger.info({ userId: session.user.id }, 'CV improved successfully');
      return validated;
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
        required: ['cvData', 'jobTitle', 'company', 'jobDescription'],
        properties: {
          cvData: { type: 'object' },
          jobTitle: { type: 'string' },
          company: { type: 'string' },
          jobDescription: { type: 'string' },
          tone: { type: 'string', enum: ['professional', 'enthusiastic', 'concise'], default: 'professional' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            coverLetter: { type: 'string' },
            wordCount: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cvData: object; jobTitle: string; company: string; jobDescription: string; tone?: 'professional' | 'enthusiastic' | 'concise' } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cvData, jobTitle, company, jobDescription, tone = 'professional' } = request.body;

    if (!cvData || !jobTitle || !company || !jobDescription) {
      return reply.status(400).send({ error: 'cvData, jobTitle, company, and jobDescription are required' });
    }

    app.logger.info({ userId: session.user.id, jobTitle, company }, 'Generating cover letter');

    try {
      const { text: coverLetterText } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt: `You are an expert cover letter writer. Write compelling, personalised cover letters that get interviews. Tone guide: professional = formal and authoritative; enthusiastic = energetic and passionate; concise = brief and punchy (max 250 words).

Write a ${tone} cover letter for a ${jobTitle} position at ${company}. Job description: ${jobDescription}. Candidate CV data: ${JSON.stringify(cvData)}. Structure: 1) Strong opening hook that grabs attention, 2) Highlight 2-3 most relevant experiences/skills from the CV that match the job, 3) Why specifically this company (use the company name), 4) Strong closing with call to action. Do NOT include placeholders like [Your Name] - use the actual name from the CV data if available.`,
      });

      const wordCount = coverLetterText.split(/\s+/).length;

      app.logger.info({ userId: session.user.id, company, wordCount }, 'Cover letter generated successfully');
      return { coverLetter: coverLetterText, wordCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate cover letter');
      return reply.status(500).send({ error: 'Failed to generate cover letter' });
    }
  });

  // POST /api/cv/export-pdf
  fastify.post('/api/cv/export-pdf', {
    schema: {
      description: 'Export CV as a professional PDF',
      tags: ['ai', 'cv'],
      body: {
        type: 'object',
        required: ['cvData'],
        properties: {
          cvData: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'PDF file',
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { cvData: CVData } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cvData } = request.body;

    if (!cvData) {
      return reply.status(400).send({ error: 'cvData is required' });
    }

    app.logger.info({ userId: session.user.id, name: (cvData as any).name }, 'Exporting CV as PDF');

    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', (err) => {
        app.logger.error({ err }, 'PDF generation error');
      });

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text((cvData as any).name || 'CV');
      doc.fontSize(10).fillColor('#666').text([(cvData as any).email, (cvData as any).phone, (cvData as any).location].filter(Boolean).join(' • '));
      doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
      doc.moveDown(1.5).fillColor('#000');

      // Summary
      if ((cvData as any).summary) {
        doc.fontSize(14).font('Helvetica-Bold').text('PROFESSIONAL SUMMARY');
        doc.fontSize(10).font('Helvetica').text((cvData as any).summary);
        doc.moveDown(1.5);
      }

      // Skills
      if ((cvData as any).skills && (cvData as any).skills.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('SKILLS');
        doc.fontSize(10).font('Helvetica').text((cvData as any).skills.join(', '));
        doc.moveDown(1.5);
      }

      // Experience
      if ((cvData as any).experience && (cvData as any).experience.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('EXPERIENCE');
        for (const exp of (cvData as any).experience) {
          doc.fontSize(10).font('Helvetica-Bold').text(`${exp.role} at ${exp.company}`);
          doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique').text(`${exp.startDate} - ${exp.endDate}`);
          doc.fontSize(10).fillColor('#000').font('Helvetica').text(exp.description);
          doc.moveDown(0.5);
        }
        doc.moveDown(1);
      }

      // Education
      if ((cvData as any).education && (cvData as any).education.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('EDUCATION');
        for (const edu of (cvData as any).education) {
          doc.fontSize(10).font('Helvetica-Bold').text(`${edu.degree} in ${edu.field}`);
          doc.fontSize(9).fillColor('#666').text(`${edu.institution}, ${edu.startDate} - ${edu.endDate}`);
          doc.fillColor('#000').moveDown(0.5);
        }
        doc.moveDown(1);
      }

      // Certifications
      if ((cvData as any).certifications && (cvData as any).certifications.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('CERTIFICATIONS');
        for (const cert of (cvData as any).certifications) {
          doc.fontSize(10).font('Helvetica').text(`• ${cert}`);
        }
      }

      doc.end();

      return new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="cv.pdf"');
          reply.send(pdf);
          resolve();
        });
        doc.on('error', reject);
      });
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to export CV as PDF');
      return reply.status(500).send({ error: 'Failed to export CV as PDF' });
    }
  });

  // POST /api/cover-letter/export-pdf
  fastify.post('/api/cover-letter/export-pdf', {
    schema: {
      description: 'Export cover letter as a professional PDF',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['coverLetter'],
        properties: {
          coverLetter: { type: 'string' },
          candidateName: { type: 'string' },
          jobTitle: { type: 'string' },
          company: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'PDF file',
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { coverLetter: string; candidateName?: string; jobTitle?: string; company?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coverLetter, candidateName, jobTitle, company } = request.body;

    if (!coverLetter) {
      return reply.status(400).send({ error: 'coverLetter is required' });
    }

    app.logger.info({ userId: session.user.id, company }, 'Exporting cover letter as PDF');

    try {
      const doc = new PDFDocument({ margin: 72 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', (err) => {
        app.logger.error({ err }, 'PDF generation error');
      });

      // Date at top right
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, '0')} ${today.toLocaleString('en-GB', { month: 'long' })} ${today.getFullYear()}`;
      doc.fontSize(10).text(dateStr, { align: 'right' });
      doc.moveDown(2);

      // Candidate info
      if (candidateName) {
        doc.fontSize(14).font('Helvetica-Bold').text(candidateName);
      }
      if (jobTitle || company) {
        doc.fontSize(10).fillColor('#666').text([jobTitle, company].filter(Boolean).join(' at '));
      }
      doc.fillColor('#000').moveDown(1);

      // Horizontal rule
      doc.moveTo(72, doc.y).lineTo(522, doc.y).stroke();
      doc.moveDown(1.5);

      // Cover letter body
      doc.fontSize(11).lineGap(6).text(coverLetter, { align: 'justify' });
      doc.moveDown(2);

      // Footer
      if (candidateName) {
        doc.fontSize(10).fillColor('#999').text(candidateName, { align: 'center' });
      }

      doc.end();

      return new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="cover-letter.pdf"');
          reply.send(pdf);
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
