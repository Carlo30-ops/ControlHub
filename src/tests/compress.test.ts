import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compress } from '../app/pages/PDFTools/tools/compress';

describe('compress tool', () => {
  let mockApi: any;
  
  beforeEach(() => {
    mockApi = {
      compress: vi.fn()
    };
  });

  it('debería lanzar error si no se proporciona archivo', async () => {
    await expect(compress(mockApi, [], 'output.pdf', {})).rejects.toThrow(
      'No se proporcionó archivo para comprimir'
    );
  });

  it('debería lanzar error si no se especifica nivel de compresión', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    await expect(compress(mockApi, files, 'output.pdf', {})).rejects.toThrow(
      'No se especificó el nivel de compresión'
    );
  });

  it('debería lanzar error si el nivel de compresión es inválido', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    await expect(compress(mockApi, files, 'output.pdf', { compressLevel: 'invalid' })).rejects.toThrow(
      'Nivel de compresión inválido: invalid'
    );
  });

  it('debería aceptar los 3 niveles de compresión estilo iLovePDF', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    const validLevels = ['screen', 'ebook', 'printer'];
    
    for (const level of validLevels) {
      mockApi.compress.mockResolvedValue({ ok: true, output: 'compressed.pdf' });
      await compress(mockApi, files, 'output.pdf', { compressLevel: level });
      expect(mockApi.compress).toHaveBeenCalledWith({
        input: 'test.pdf',
        output: 'output.pdf',
        level: level
      });
    }
  });

  it('debería llamar a la API con los parámetros correctos', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    mockApi.compress.mockResolvedValue({ 
      ok: true, 
      output: 'compressed.pdf',
      original_size: 1000000,
      compressed_size: 500000,
      reduction_percent: 50.0,
      engine: 'ghostscript'
    });

    await compress(mockApi, files, 'output.pdf', { compressLevel: 'ebook' });

    expect(mockApi.compress).toHaveBeenCalledWith({
      input: 'test.pdf',
      output: 'output.pdf',
      level: 'ebook'
    });
  });

  it('debería propagar errores de la API', async () => {
    const files = [{ path: 'test.pdf', name: 'test.pdf' }];
    mockApi.compress.mockRejectedValue(new Error('Error de sidecar'));

    await expect(compress(mockApi, files, 'output.pdf', { compressLevel: 'screen' })).rejects.toThrow(
      'Error de sidecar'
    );
  });
});
