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

test('edit modal X button prevents form submit and click fall-through', () => {
  const closeIndex = source.indexOf('className="admin-modal-close"');
  const closeButton = source.slice(closeIndex - 120, source.indexOf('✕', closeIndex));
  expect(closeButton).toContain('type="button"');
  expect(closeButton).toContain('stopPropagation');
  expect(closeButton).toContain('preventDefault');
  expect(closeButton).toContain('onMouseDown');
  expect(source).toContain('skipEditSaveRef.current = true');
  expect(source).toContain('if (skipEditSaveRef.current || !editingProduct) return;');
});

test('uploadError resets when the edited product id or tab changes, not on each keystroke', () => {
  expect(source).toContain('const editingProductId = editingProduct?.id ?? null;');
  expect(source).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{\s*setUploadError\(null\);\s*\},\s*\[editingProductId, activeTab\]\)/);
  expect(source).toContain("if (event.key !== 'Escape') return;");
});
