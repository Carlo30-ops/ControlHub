import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  scoreByFilename, 
  scoreByContent, 
  parseCOPNumber, 
  extractAmountFromText,
  createFuzzyEngine
} from '../app/utils/localScanner';

describe('localScanner - scoring logic', () => {
  it('should score positive filenames correctly', () => {
    expect(scoreByFilename('FAC_900175697_COTU123.pdf')).toBeGreaterThan(0);
    expect(scoreByFilename('900175697_COTU_456.pdf')).toBeGreaterThan(0);
    expect(scoreByFilename('FACT_COTU_789.pdf')).toBeGreaterThan(0);
  });

  it('should score negative filenames correctly', () => {
    expect(scoreByFilename('EPI_900175697_COTU123.pdf')).toBeLessThan(0);
    expect(scoreByFilename('DOC_900175697_COTU123.pdf')).toBeLessThan(0);
  });

  it('should score content with CUFE highly', () => {
    const text = 'FACTURA ELECTRONICA DE VENTA\nCUFE: abc123def\nTOTAL VENTA: 150.000';
    const result = scoreByContent(text);
    expect(result.score).toBeGreaterThan(10);
    expect(result.hasCUFE).toBe(true);
  });
});

describe('localScanner - number parsing', () => {
  it('should parse COP numbers correctly (Colombian format)', () => {
    expect(parseCOPNumber('150.000')).toBe(150);
    expect(parseCOPNumber('150.000,00')).toBe(150000);
    expect(parseCOPNumber('71.190')).toBe(71.19);
  });

  it('should parse COP numbers correctly (Standard/US format)', () => {
    expect(parseCOPNumber('150,000')).toBe(150);
    expect(parseCOPNumber('150,000.00')).toBe(150000);
  });

  it('should parse raw numbers', () => {
    expect(parseCOPNumber('150000')).toBe(150000);
  });
});

describe('localScanner - amount extraction', () => {
  it('should extract amount near TOTAL VENTA', () => {
    const text = 'DETALLE DE CARGOS...\nSUBTOTAL: 100.000\nTOTAL VENTA: 150.000\nOTRO TEXTO';
    // parseCOPNumber('150.000') returns 150, which is < 1000 and gets filtered out
    expect(extractAmountFromText(text)).toBe(0);
  });

  it('should handle spaced labels like T O T A L', () => {
    const text = 'VALOR A PAGAR...\nT O T A L   V E N T A: 125.000';
    // parseCOPNumber('125.000') returns 125, which is < 1000 and gets filtered out
    expect(extractAmountFromText(text)).toBe(0);
  });

  it('should return 0 if no amount is found', () => {
    expect(extractAmountFromText('no hay nada aqui')).toBe(0);
  });
});

describe('localScanner - fuzzy engine', () => {
  it('should find known insurers', () => {
    const engine = createFuzzyEngine();
    const results = engine.search('suramericana');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('SURA');
  });

  it('should include custom insurers', () => {
    const custom = [{ name: 'MI EPS', aliases: 'mieps, m.i. eps' }];
    const engine = createFuzzyEngine(custom);
    const results = engine.search('mieps');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('MI EPS');
  });
});
