import { describe, test, expect } from 'bun:test';
import { normalizeImageUrl, isValidImageUrl, rejectTemporaryUrls } from '../src/lib/image-url.ts';

describe('Image URL normalization and validation', () => {

  describe('normalizeImageUrl', () => {
    test('rejects blob URLs', () => {
      expect(normalizeImageUrl('blob:http://localhost:3000/abc-123')).toBe(null);
      expect(normalizeImageUrl('  blob:something  ')).toBe(null);
    });

    test('rejects data URLs', () => {
      expect(normalizeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(null);
      expect(normalizeImageUrl('  data:image/jpeg;base64,/9j/4AAQ  ')).toBe(null);
    });

    test('normalizes Google Drive file/d/ share links', () => {
      const fileId = '1A2B3C4D5E6F7G8H9I0J';
      expect(normalizeImageUrl(`https://drive.google.com/file/d/${fileId}/view?usp=sharing`))
        .toBe(`https://lh3.googleusercontent.com/d/${fileId}`);
      expect(normalizeImageUrl(`https://drive.google.com/file/d/${fileId}/view`))
        .toBe(`https://lh3.googleusercontent.com/d/${fileId}`);
    });

    test('normalizes Google Drive open?id= links', () => {
      const fileId = 'abc123XYZ-_456';
      expect(normalizeImageUrl(`https://drive.google.com/open?id=${fileId}`))
        .toBe(`https://lh3.googleusercontent.com/d/${fileId}`);
    });

    test('normalizes Google Drive uc?id= links', () => {
      const fileId = 'testFileId123';
      expect(normalizeImageUrl(`https://drive.google.com/uc?id=${fileId}&export=download`))
        .toBe(`https://lh3.googleusercontent.com/d/${fileId}`);
    });

    test('passes through regular HTTPS URLs unchanged', () => {
      const url = 'https://example.com/image.jpg';
      expect(normalizeImageUrl(url)).toBe(url);
      
      const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile.webp?alt=media&token=abc';
      expect(normalizeImageUrl(firebaseUrl)).toBe(firebaseUrl);
    });

    test('trims whitespace', () => {
      const url = 'https://example.com/image.png';
      expect(normalizeImageUrl(`  ${url}  `)).toBe(url);
    });

    test('returns null for empty strings', () => {
      expect(normalizeImageUrl('')).toBe(null);
      expect(normalizeImageUrl('   ')).toBe(null);
    });
  });

  describe('isValidImageUrl', () => {
    test('validates HTTPS URLs', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
    });

    test('validates HTTP URLs', () => {
      expect(isValidImageUrl('http://localhost:3000/uploads/test.png')).toBe(true);
    });

    test('rejects blob URLs', () => {
      expect(isValidImageUrl('blob:http://localhost/abc')).toBe(false);
    });

    test('rejects data URLs', () => {
      expect(isValidImageUrl('data:image/png;base64,abc')).toBe(false);
    });

    test('rejects invalid URLs', () => {
      expect(isValidImageUrl('not a url')).toBe(false);
      expect(isValidImageUrl('')).toBe(false);
    });

    test('validates normalized Drive URLs', () => {
      const result = normalizeImageUrl('https://drive.google.com/file/d/testId/view');
      expect(isValidImageUrl(result)).toBe(true);
    });
  });

  describe('rejectTemporaryUrls', () => {
    test('rejects blob URLs', () => {
      expect(rejectTemporaryUrls('blob:http://localhost/abc')).toBe(null);
    });

    test('rejects data URLs', () => {
      expect(rejectTemporaryUrls('data:image/png;base64,abc')).toBe(null);
    });

    test('passes through regular URLs', () => {
      const url = 'https://example.com/image.jpg';
      expect(rejectTemporaryUrls(url)).toBe(url);
    });

    test('trims whitespace', () => {
      const url = 'https://example.com/image.jpg';
      expect(rejectTemporaryUrls(`  ${url}  `)).toBe(url);
    });
  });
});
