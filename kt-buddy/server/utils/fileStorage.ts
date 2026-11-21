import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../db/database.ts';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

export const ALLOWED_DOC_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg']);
export const ALLOWED_SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);

export const UPLOADS_DIR = (() => {
  const dir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
})();

export function sanitizeStoredFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48);
  const unique = crypto.randomBytes(6).toString('hex');
  return `${base || 'document'}_${unique}${ext}`;
}

export function resolveSafeUploadPath(storedRelativeName: string): string | null {
  if (!storedRelativeName || storedRelativeName.includes('..')) {
    return null;
  }
  const cleanName = path.basename(storedRelativeName);
  const resolved = path.resolve(UPLOADS_DIR, cleanName);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

export function saveBufferToUploads(buffer: Buffer, originalName: string): { fileName: string; storedPath: string; sizeBytes: number } {
  const storedName = sanitizeStoredFilename(originalName);
  const targetPath = resolveSafeUploadPath(storedName);
  if (!targetPath) {
    throw new Error('Invalid file destination');
  }
  fs.writeFileSync(targetPath, buffer);
  return {
    fileName: path.basename(originalName).slice(0, 120),
    storedPath: storedName,
    sizeBytes: buffer.length,
  };
}

export function deleteUploadedFile(storedRelativeName: string | null | undefined): void {
  if (!storedRelativeName) return;
  const target = resolveSafeUploadPath(storedRelativeName);
  if (target && fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
    } catch {
      // ignore cleanup error
    }
  }
}

// Escape ASCII characters for PDF literal strings
function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a valid, self-contained PDF 1.4 document buffer for seeded sample PDFs
 * and dynamic Examination Timetable PDF downloads.
 */
export function buildSimplePdfBuffer(title: string, lines: string[]): Buffer {
  const safeLines = [title, '', ...lines].slice(0, 46);
  const contentLines: string[] = ['BT', '/F1 15 Tf', '50 760 Td'];

  safeLines.forEach((line, idx) => {
    if (idx === 0) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      contentLines.push('/F1 10 Tf');
      contentLines.push('0 -22 Td');
    } else {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      contentLines.push('0 -15 Td');
    }
  });
  contentLines.push('ET');
  const streamData = contentLines.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamData, 'utf8')} >>\nstream\n${streamData}\nendstream\nendobj\n`
  );
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
