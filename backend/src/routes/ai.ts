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

// Request body interfaces
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
  title?: string;
}

interface GenerateCoverLetterBody {
  job_title: string;
  company: string;
  job_description: string;
  cv_text: string;
  tone?: 'professional' | 'enthusiastic' | 'concise';
}

interface ExportCoverLetterPDFBody {
  cover_letter: string;
  candidate_name?: string;
  job_title?: string;
  company?: string;
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
          experience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                company: { type: 'string' },
                duration: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                degree: { type: 'string' },
                institution: { type: 'string' },
                year: { type: 'string' },
              },
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
  }, async (request: FastifyRequest<{ Body: GenerateCVBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { name, email, target_role, experience = [], education = [], skills = [], summary = '' } = request.body;

    if (!name || !email || !target_role) {
      return reply.status(400).send({ error: 'name, email, and target_role are required' });
    }

    app.logger.info({ userId: session.user.id, name, target_role }, 'Generating CV');

    try {
      const experienceText = experience.map((exp: any) =>
        `- ${exp.title} at ${exp.company} (${exp.duration}): ${exp.description}`
      ).join('\n') || 'No experience provided';

      const educationText = education.map((edu: any) =>
        `- ${edu.degree} from ${edu.institution} (${edu.year})`
      ).join('\n') || 'No education provided';

      const skillsText = skills.length > 0 ? skills.join(', ') : 'No skills provided';

      const prompt = `Generate a professional, ATS-optimized CV for ${name} (${email}) targeting a ${target_role} position.

Personal Information:
- Name: ${name}
- Email: ${email}
- Target Role: ${target_role}

Experience:
${experienceText}

Education:
${educationText}

Skills:
${skillsText}

Summary:
${summary || 'Not provided'}

Create a comprehensive CV with the following sections:
1. Professional Summary (tailored to the target role)
2. Experience (formatted professionally with bullet points)
3. Education (formatted professionally)
4. Skills (organized by category if possible)
5. Achievements (key accomplishments from their background)

Return ONLY a valid JSON object with two keys:
- "cv_text": the full CV as plain text with section headers
- "sections": an object with keys: professional_summary, experience, education, skills, achievements

No markdown code fences, just pure JSON.`;

      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt,
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        app.logger.warn({ err: parseErr }, 'Failed to parse JSON, attempting to extract');
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      }

      app.logger.info({ userId: session.user.id, name }, 'CV generated successfully');
      return {
        cv_text: parsed.cv_text || '',
        sections: {
          professional_summary: parsed.sections?.professional_summary || '',
          experience: parsed.sections?.experience || '',
          education: parsed.sections?.education || '',
          skills: parsed.sections?.skills || '',
          achievements: parsed.sections?.achievements || '',
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
      description: 'Improve an existing CV using AI',
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
      const focusText = focus_areas.length > 0
        ? `Pay special attention to improving these areas: ${focus_areas.join(', ')}`
        : '';

      const prompt = `Analyze and improve the following CV for a ${target_role} position. ${focusText}

Original CV:
${cv_text}

Please:
1. Score the original CV out of 100 for fit with the ${target_role} role
2. Improve the CV to better match the ${target_role} position, focusing on:
   - Strengthening impact statements and quantifying achievements
   - Adding relevant industry keywords
   - Improving formatting and readability
   - Highlighting relevant achievements
   - Crafting a stronger professional summary
3. Score the improved CV out of 100
4. List 3-5 specific improvements made

Return ONLY a valid JSON object with keys:
- "improved_cv_text": the full improved CV as plain text
- "suggestions": array of specific improvement suggestions made
- "score_before": original CV score (0-100)
- "score_after": improved CV score (0-100)

No markdown code fences, just pure JSON.`;

      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt,
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        app.logger.warn({ err: parseErr }, 'Failed to parse JSON, attempting to extract');
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      }

      app.logger.info({ userId: session.user.id, scoreBefore: parsed.score_before, scoreAfter: parsed.score_after }, 'CV improved successfully');
      return {
        improved_cv_text: parsed.improved_cv_text || '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        score_before: Number(parsed.score_before) || 0,
        score_after: Number(parsed.score_after) || 0,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to improve CV');
      return reply.status(500).send({ error: 'Failed to improve CV' });
    }
  });

  // POST /api/cv/parse
  fastify.post('/api/cv/parse', {
    schema: {
      description: 'Parse an uploaded CV file and extract structured data',
      tags: ['ai', 'cv'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            parsed: {
              type: 'object',
              properties: {
                name: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                phone: { type: ['string', 'null'] },
                job_title: { type: ['string', 'null'] },
                skills: { type: 'array', items: { type: 'string' } },
                summary: { type: ['string', 'null'] },
              },
            },
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

      const mimeType = data.mimetype;
      const buffer = await data.toBuffer();

      app.logger.debug({ mimeType, size: buffer.length }, 'File received');

      let cvText = '';

      // Extract text based on MIME type
      if (mimeType === 'application/pdf') {
        try {
          const pdfData = await pdfParse(buffer);
          cvText = pdfData.text || '';
        } catch (pdfErr) {
          app.logger.warn({ err: pdfErr }, 'PDF parsing failed, using UTF-8 fallback');
          cvText = buffer.toString('utf-8');
        }
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          const result = await mammoth.extractRawText({ buffer });
          cvText = result.value || '';
        } catch (docxErr) {
          app.logger.warn({ err: docxErr }, 'DOCX parsing failed, using UTF-8 fallback');
          cvText = buffer.toString('utf-8');
        }
      } else if (mimeType === 'application/msword') {
        // DOC format: best-effort extraction
        cvText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\t]/g, ' ').trim();
      } else {
        return reply.status(400).send({ error: 'Unsupported file type. Please upload PDF, DOCX, or DOC.' });
      }

      if (!cvText || cvText.trim().length === 0) {
        return reply.status(400).send({ error: 'Could not extract text from file' });
      }

      // Parse with GPT-4o
      app.logger.debug({}, 'Parsing CV text with AI');

      const prompt = `Extract structured information from the following CV text. Return ONLY a JSON object with these keys:
- "name": the candidate's name (string or null)
- "email": the candidate's email (string or null)
- "phone": the candidate's phone number (string or null)
- "job_title": the candidate's current or most recent job title (string or null)
- "skills": an array of skills listed in the CV
- "summary": a brief professional summary or objective (string or null)

If a field is not found, use null.

CV Text:
${cvText}

Return ONLY a valid JSON object, no markdown code fences.`;

      const { text: response } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt,
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        app.logger.warn({ err: parseErr }, 'Failed to parse JSON, attempting to extract');
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { name: null, email: null, phone: null, job_title: null, skills: [], summary: null };
        }
      }

      app.logger.info({ userId: session.user.id, name: parsed.name }, 'CV parsed successfully');
      return {
        text: cvText,
        parsed: {
          name: parsed.name || null,
          email: parsed.email || null,
          phone: parsed.phone || null,
          job_title: parsed.job_title || null,
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          summary: parsed.summary || null,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to parse CV');
      return reply.status(500).send({ error: 'Failed to parse CV' });
    }
  });

  // POST /api/cv/export-pdf
  fastify.post('/api/cv/export-pdf', {
    schema: {
      description: 'Export CV content as a PDF file',
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
  }, async (request: FastifyRequest<{ Body: ExportPDFBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { content, title = 'cv' } = request.body;

    if (!content) {
      return reply.status(400).send({ error: 'content is required' });
    }

    app.logger.info({ userId: session.user.id, title }, 'Exporting CV as PDF');

    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', (err) => {
        app.logger.error({ err }, 'PDF generation error');
      });

      // Add title if provided
      if (title) {
        doc.fontSize(16).font('Helvetica-Bold').text(title, { underline: true });
        doc.moveDown(1);
      }

      // Add content
      doc.fontSize(11).font('Helvetica').text(content);

      doc.end();

      return new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          const sanitizedTitle = title
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '')
            || 'cv';

          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `attachment; filename="${sanitizedTitle}.pdf"`);
          reply.send(pdf);

          app.logger.info({ userId: session.user.id, title }, 'CV exported as PDF successfully');
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
      description: 'Generate a professional cover letter using AI',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['job_title', 'company', 'job_description', 'cv_text'],
        properties: {
          job_title: { type: 'string' },
          company: { type: 'string' },
          job_description: { type: 'string' },
          cv_text: { type: 'string' },
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

    const { job_title, company, job_description, cv_text, tone = 'professional' } = request.body;

    if (!job_title || !company || !job_description || !cv_text) {
      return reply.status(400).send({ error: 'job_title, company, job_description, and cv_text are required' });
    }

    app.logger.info({ userId: session.user.id, company, job_title }, 'Generating cover letter');

    try {
      const toneGuide = {
        professional: 'formal and authoritative',
        enthusiastic: 'energetic and passionate',
        concise: 'brief and punchy (max 250 words)',
      };

      const prompt = `Write a ${tone} cover letter for a ${job_title} position at ${company}.

Job Description:
${job_description}

Candidate CV:
${cv_text}

Write a compelling, personalized cover letter. Tone: ${toneGuide[tone as keyof typeof toneGuide]}.

Structure:
1. Strong opening hook that grabs attention
2. Highlight 2-3 most relevant experiences/skills from the CV that match the job
3. Why specifically this company (use the company name)
4. Strong closing with call to action

Do NOT include placeholders. Make it specific and personal. Return ONLY the cover letter text, no markdown formatting.`;

      const { text: coverLetterText } = await generateText({
        model: gateway('openai/gpt-4o'),
        prompt,
      });

      const wordCount = coverLetterText.split(/\s+/).length;

      app.logger.info({ userId: session.user.id, company, wordCount }, 'Cover letter generated successfully');
      return { cover_letter: coverLetterText, word_count: wordCount };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to generate cover letter');
      return reply.status(500).send({ error: 'Failed to generate cover letter' });
    }
  });

  // POST /api/cover-letter/export-pdf
  fastify.post('/api/cover-letter/export-pdf', {
    schema: {
      description: 'Export cover letter as a PDF file',
      tags: ['ai', 'cover-letter'],
      body: {
        type: 'object',
        required: ['cover_letter'],
        properties: {
          cover_letter: { type: 'string' },
          candidate_name: { type: 'string' },
          job_title: { type: 'string' },
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
  }, async (request: FastifyRequest<{ Body: ExportCoverLetterPDFBody }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { cover_letter, candidate_name, job_title, company } = request.body;

    if (!cover_letter) {
      return reply.status(400).send({ error: 'cover_letter is required' });
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
      if (candidate_name) {
        doc.fontSize(14).font('Helvetica-Bold').text(candidate_name);
      }
      if (job_title || company) {
        doc.fontSize(10).fillColor('#666').text([job_title, company].filter(Boolean).join(' at '));
      }
      doc.fillColor('#000').moveDown(1);

      // Horizontal rule
      doc.moveTo(72, doc.y).lineTo(522, doc.y).stroke();
      doc.moveDown(1.5);

      // Cover letter body
      doc.fontSize(11).lineGap(6).text(cover_letter, { align: 'justify' });
      doc.moveDown(2);

      // Footer
      if (candidate_name) {
        doc.fontSize(10).fillColor('#999').text(candidate_name, { align: 'center' });
      }

      doc.end();

      return new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', 'attachment; filename="cover-letter.pdf"');
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
