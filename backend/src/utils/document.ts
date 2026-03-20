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
      let pdfParseModule = require('pdf-parse');

      // Try to extract text from PDF
      let pdfData: any;

      try {
        // Find the actual pdf-parse function by trying various approaches
        let pdfParseFunc: any = null;

        // Try direct call
        if (typeof pdfParseModule === 'function') {
          pdfParseFunc = pdfParseModule;
        }
        // Try .default property
        else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
          pdfParseFunc = pdfParseModule.default;
        }
        // Try common property names
        else {
          const commonNames = ['parse', 'pdf', 'PDFParser', 'Parser', 'default'];
          for (const name of commonNames) {
            if (pdfParseModule[name] && typeof pdfParseModule[name] === 'function') {
              pdfParseFunc = pdfParseModule[name];
              break;
            }
          }
        }

        // If we found a function, call it
        if (pdfParseFunc) {
          pdfData = await pdfParseFunc(buffer);
        } else {
          // Last resort: try any callable property
          const keys = Object.keys(pdfParseModule);
          let found = false;
          for (const key of keys) {
            if (typeof pdfParseModule[key] === 'function') {
              try {
                pdfData = await pdfParseModule[key](buffer);
                found = true;
                break;
              } catch {
                // Try next function
              }
            }
          }

          if (!found) {
            throw new Error('pdf-parse module has no callable function');
          }
        }
      } catch (pdferror) {
        // If pdf-parse fails, return error with details
        throw new Error(`pdf-parse error: ${pdferror instanceof Error ? pdferror.message : String(pdferror)}`);
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
