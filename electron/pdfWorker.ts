import fs from 'node:fs';
// @ts-ignore — pdf-parse no tiene tipos oficiales
import pdfParse from 'pdf-parse';

// ─────────────────────────────────────────────────────────────────────────────
// pdfWorker.ts — Worker Thread para extracción de texto PDF
//
// Fix: I/O asíncrono (fs.promises) en vez de readFileSync bloqueante
// Fix: Acepta maxPages opcional:
//   - maxPages = 1  → solo primera página (fast path, para identificación)
//   - maxPages = undefined → todas las páginas (para extracción de montos)
// ─────────────────────────────────────────────────────────────────────────────

if (process.parentPort) {
    process.parentPort.on('message', async (e: any) => {
        const msg = e.data;
        try {
            const dataBuffer = await fs.promises.readFile(msg.pdfPath);
            const options = msg.maxPages ? { max: msg.maxPages } : undefined;
            const data = await pdfParse(dataBuffer, options);
            process.parentPort.postMessage({ 
                success: true, 
                text: data.text, 
                pageCount: data.numpages 
            });
        } catch (error: any) {
            process.parentPort.postMessage({ success: false, error: error.message });
        }
    });
}
