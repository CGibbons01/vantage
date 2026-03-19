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
 * Extract text from file based on MIME type
 * - For application/pdf: uses pdf-parse via createRequire
 * - For Word documents: uses mammoth.extractRawText
 * - Throws error for unsupported types with descriptive message including MIME type
 */
export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  const mimeTypeLower = (mimeType || '').toLowerCase();

  try {
    if (mimeTypeLower === 'application/pdf') {
      // Use pdf-parse via createRequire (CommonJS pattern)
      const require = createRequire(import.meta.url);
      let pdfParse = require('pdf-parse');

      // Handle different module export patterns
      // Try to get the actual function from the module
      if (typeof pdfParse !== 'function') {
        // If it's not a function, try .default
        if (pdfParse.default && typeof pdfParse.default === 'function') {
          pdfParse = pdfParse.default;
        } else {
          // If .default doesn't work, it might be a class, so we'll try to use it with 'new'
          // But first, try to call it and catch if it needs 'new'
          pdfParse = pdfParse as any;
        }
      }

      // Try to extract text using pdf-parse
      let pdfData: any;
      try {
        // Try calling as a function
        if (typeof pdfParse === 'function') {
          pdfData = await pdfParse(buffer);
        } else {
          // If it's not a function, try with 'new' keyword
          const instance = new pdfParse(buffer);
          pdfData = await instance;
        }
      } catch (error) {
        // If direct call failed and it's not a function, try with 'new'
        if (!(error instanceof TypeError && typeof pdfParse !== 'function')) {
          throw error;
        }
        try {
          const instance = new pdfParse(buffer);
          pdfData = await instance;
        } catch (newError) {
          throw error; // Throw original error if 'new' also fails
        }
      }

      return pdfData.text || '';
    } else if (
      mimeTypeLower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeTypeLower === 'application/msword'
    ) {
      // Use mammoth for Word documents
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Unsupported file type')) {
      throw error;
    }
    throw new Error(`Failed to extract text from file (MIME type: ${mimeType}): ${message}`);
  }
}
