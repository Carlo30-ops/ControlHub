import { describe, it, expect, vi, beforeEach } from 'vitest';
import { split } from '../app/pages/PDFTools/tools/split';

describe('split tool', () => {
  let mockApi: any;
  
  beforeEach(() => {
    mockApi = {
      split: vi.fn()
    };
  });

  it('debería lanzar error si no se proporciona archivo', async () => {
    await expect(split(mockApi, [], 'output', {})).rejects.toThrow(
      'No se proporcionó archivo para dividir'
    );
  });

  it('debería lanzar error si no se especifican rangos', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    await expect(split(mockApi, files, 'output', {})).rejects.toThrow(
      'No se especificaron rangos de páginas'
    );
  });

  it('debería lanzar error si el formato de rangos es inválido', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    await expect(split(mockApi, files, 'output', { splitRanges: 'invalid' })).rejects.toThrow(
      'Formato de rangos inválido. Usa: "1-3, 5, 7-z"'
    );
  });

  it('debería aceptar rangos válidos', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    const validRanges = ['1-3', '5', '7-z', '1-3, 5, 7-z'];
    
    for (const range of validRanges) {
      mockApi.split.mockResolvedValue({ ok: true, outputs: ['part1.pdf'] });
      await split(mockApi, files, 'output', { splitRanges: range });
      expect(mockApi.split).toHaveBeenCalledWith({
        input: 'test.pdf',
        output_dir: 'output',
        ranges: range,
        naming_pattern: 'part'
      });
    }
  });

  it('debería usar patrón de nombres personalizado', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    mockApi.split.mockResolvedValue({ ok: true, outputs: ['part1.pdf'] });

    await split(mockApi, files, 'output', { splitRanges: '1-3', namingPattern: 'range' });

    expect(mockApi.split).toHaveBeenCalledWith({
      input: 'test.pdf',
      output_dir: 'output',
      ranges: '1-3',
      naming_pattern: 'range'
    });
  });

  it('debería usar patrón de nombres por defecto', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    mockApi.split.mockResolvedValue({ ok: true, outputs: ['part1.pdf'] });

    await split(mockApi, files, 'output', { splitRanges: '1-3' });

    expect(mockApi.split).toHaveBeenCalledWith({
      input: 'test.pdf',
      output_dir: 'output',
      ranges: '1-3',
      naming_pattern: 'part'
    });
  });

  it('debería propagar errores de la API', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    mockApi.split.mockRejectedValue(new Error('Error de sidecar'));

    await expect(split(mockApi, files, 'output', { splitRanges: '1-3' })).rejects.toThrow(
      'Error de sidecar'
    );
  });
});
