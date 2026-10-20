import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/app/studio-desk/page.tsx', import.meta.url)), 'utf8');

test('opening or cancelling Add or Edit clears the shared image validation alert', () => {
  expect(source).toContain('setUploadError(null)');
  expect(source).toContain('const openAddForm');
  expect(source).toContain('const closeAddForm');
  expect(source).toContain('const closeEditForm');
  expect(source).toContain('onClick={openAddForm}');
  expect(source).toContain('onClick={closeAddForm}');
  expect(source).toContain('onClick={closeEditForm}');
  expect(source).toMatch(/clearFormAlerts\(\);\s*setEditingProduct\(/);
  expect(source).toContain('Please upload the file or paste a permanent image URL');
});
