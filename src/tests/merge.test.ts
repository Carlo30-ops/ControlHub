import { describe, it, expect, vi, beforeEach } from 'vitest';
import { merge } from '../app/pages/PDFTools/tools/merge';

describe('merge tool', () => {
  let mockApi: any;
  
  beforeEach(() => {
    mockApi = {
      merge: vi.fn()
    };
  });

  it('debería lanzar error si no se proporcionan archivos', async () => {
    await expect(merge(mockApi, [], 'output.pdf')).rejects.toThrow(
      'No se proporcionaron archivos para fusionar'
    );
  });

  it('debería lanzar error si solo se proporciona un archivo', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    await expect(merge(mockApi, files, 'output.pdf')).rejects.toThrow(
      'Se requieren al menos 2 archivos para fusionar'
    );
  });

  it('debería lanzar error si hay archivos duplicados', async () => {
    const files = [
      { path: 'test1.pdf', name: 'test1.pdf' },
      { path: 'test1.pdf', name: 'test1.pdf' }
    ];
    await expect(merge(mockApi, files, 'output.pdf')).rejects.toThrow(
      'Se detectaron archivos duplicados en la lista'
    );
  });

  it('debería llamar a la API con los parámetros correctos', async () => {
    const files = [
      { path: 'test1.pdf', name: 'test1.pdf' },
      { path: 'test2.pdf', name: 'test2.pdf' }
    ];
    mockApi.merge.mockResolvedValue({ ok: true, output: 'merged.pdf' });

    await merge(mockApi, files, 'output.pdf', { preserveBookmarks: true, renumberPages: false });

    expect(mockApi.merge).toHaveBeenCalledWith({
      files: ['test1.pdf', 'test2.pdf'],
      output: 'output.pdf',
      preserve_bookmarks: true,
      renumber_pages: false
    });
  });

  it('debería usar valores por defecto para parámetros opcionales', async () => {
    const files = [
      { path: 'test1.pdf', name: 'test1.pdf' },
      { path: 'test2.pdf', name: 'test2.pdf' }
    ];
    mockApi.merge.mockResolvedValue({ ok: true, output: 'merged.pdf' });

    await merge(mockApi, files, 'output.pdf');

    expect(mockApi.merge).toHaveBeenCalledWith({
      files: ['test1.pdf', 'test2.pdf'],
      output: 'output.pdf',
      preserve_bookmarks: true,
      renumber_pages: false
    });
  });

  it('debería propagar errores de la API', async () => {
    const files = [
      { path: 'test1.pdf', name: 'test1.pdf' },
      { path: 'test2.pdf', name: 'test2.pdf' }
    ];
    mockApi.merge.mockRejectedValue(new Error('Error de sidecar'));

    await expect(merge(mockApi, files, 'output.pdf')).rejects.toThrow(
      'Error de sidecar'
    );
  });

  it('debería enviar parámetro renumber_pages cuando se activa', async () => {
    const files = [
      { path: 'test1.pdf', name: 'test1.pdf' },
      { path: 'test2.pdf', name: 'test2.pdf' }
    ];
    mockApi.merge.mockResolvedValue({ ok: true, output: 'merged.pdf' });

    await merge(mockApi, files, 'output.pdf', { preserveBookmarks: true, renumberPages: true });

    expect(mockApi.merge).toHaveBeenCalledWith({
      files: ['test1.pdf', 'test2.pdf'],
      output: 'output.pdf',
      preserve_bookmarks: true,
      renumber_pages: true
    });
  });
});
