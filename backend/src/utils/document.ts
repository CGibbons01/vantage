import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import { createRequire } from 'module';

/**
 * Generate a PDF from text content
 * Detects headings (ALL CAPS or lines ending with :) and formats them in bold
 */
export function generatePDF(content: string, title?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margins: 72, // 72pt margins on all sides
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title if provided
      if (title) {
        doc.fontSize(20).font('Helvetica-Bold').text(title, {
          align: 'center',
        });
        doc.moveDown(1);
      }

      // Parse content into lines and paragraphs
      const lines = content.split('\n');
      let currentParagraph: string[] = [];

      for (const line of lines) {
        if (line.trim() === '') {
          // Empty line = paragraph break
          if (currentParagraph.length > 0) {
            renderParagraph(doc, currentParagraph);
            currentParagraph = [];
            doc.moveDown(0.5);
          }
        } else {
          currentParagraph.push(line);
        }
      }

      // Render remaining paragraph
      if (currentParagraph.length > 0) {
        renderParagraph(doc, currentParagraph);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render a paragraph with heading detection
 */
function renderParagraph(doc: PDFDocument, lines: string[]) {
  for (const line of lines) {
    const trimmed = line.trim();

    // Detect headings: ALL CAPS or ends with :
    const isHeading =
      trimmed === trimmed.toUpperCase() && trimmed.length > 0 && /[A-Z]/.test(trimmed) ||
      trimmed.endsWith(':');

    if (isHeading) {
      doc.fontSize(13).font('Helvetica-Bold').text(trimmed);
    } else {
      doc.fontSize(11).font('Helvetica').text(trimmed, {
        lineGap: 2,
      });
    }
  }
}

/**
 * Extract text from PDF buffer using pdf-parse
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    return pdfData.text || '';
  } catch (error) {
    // If pdf-parse fails (e.g., invalid PDF), fall back to treating as plain text
    try {
      const text = buffer.toString('utf-8');
      if (text.trim().length > 0) {
        return text;
      }
    } catch {
      // Ignore UTF-8 conversion errors
    }
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

/**
 * Extract text from DOCX buffer using mammoth
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    // If mammoth fails (e.g., invalid DOCX), fall back to treating as plain text
    try {
      const text = buffer.toString('utf-8');
      if (text.trim().length > 0) {
        return text;
      }
    } catch {
      // Ignore UTF-8 conversion errors
    }
    throw new Error(`Failed to extract text from DOCX: ${error}`);
  }
}

/**
 * Extract text from file based on mimetype or filename
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    return extractTextFromPDF(buffer);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    return extractTextFromDOCX(buffer);
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }
}
