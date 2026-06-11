// ─────────────────────────────────────────────────────────────────────────────
// workerPool.ts — Pool reutilizable de Worker Threads para PDF parsing
// Fix #10: Evita crear/destruir un Worker por cada PDF. En su lugar
// mantiene N workers vivos durante todo el escaneo y reutiliza el
// mismo proceso para múltiples tareas, reduciendo significativamente
// el overhead de memoria y tiempo de arranque.
// ─────────────────────────────────────────────────────────────────────────────
import { utilityProcess, UtilityProcess } from 'electron';

interface PoolSlot {
  worker: UtilityProcess;
  busy: boolean;
  resolve?: (result: any) => void;
  reject?: (err: Error) => void;
}

interface QueuedTask {
  pdfPath: string;
  maxPages?: number;
  resolve: (result: any) => void;
  reject: (err: Error) => void;
}

export class WorkerPool {
  private slots: PoolSlot[] = [];
  private queue: QueuedTask[] = [];
  private readonly workerPath: string;

  constructor(size: number, workerPath: string) {
    this.workerPath = workerPath;
    for (let i = 0; i < size; i++) {
      this.addSlot();
    }
  }

  // ── Crear e inicializar un slot de worker ─────────────────────────────────
  private addSlot(): void {
    const slot: PoolSlot = {
      worker: null as unknown as UtilityProcess, // se asigna en createWorker
      busy: false,
    };
    slot.worker = this.createWorker(slot);
    this.slots.push(slot);
  }

  // ── Construir un Worker con los event handlers correctos ─────────────────
  private createWorker(slot: PoolSlot): UtilityProcess {
    const worker = utilityProcess.fork(this.workerPath);

    worker.on('message', (msg: any) => {
      const resolve = slot.resolve;
      slot.busy = false;
      slot.resolve = undefined;
      slot.reject = undefined;
      resolve?.(msg);
      this.processQueue();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[WorkerPool] UtilityProcess (Worker) crashed with code: ${code}`);
        const reject = slot.reject;
        slot.busy = false;
        slot.resolve = undefined;
        slot.reject = undefined;
        // Lanzamos el reject para que localScanner marque parseError = true
        reject?.(new Error(`Worker crashed with code ${code}`));
        
        // Recrear el worker muerto automáticamente
        slot.worker = this.createWorker(slot);
        this.processQueue();
      }
    });

    return worker;
  }

  // ── Despachar la siguiente tarea de la cola a un worker libre ─────────────
  private processQueue(): void {
    if (this.queue.length === 0) return;
    const idleSlot = this.slots.find(s => !s.busy);
    if (!idleSlot) return;

    const task = this.queue.shift()!;
    idleSlot.busy = true;
    idleSlot.resolve = task.resolve;
    // Enviar objeto con pdfPath + maxPages al worker
    idleSlot.worker.postMessage({ pdfPath: task.pdfPath, maxPages: task.maxPages });
  }

  /** Parsear un PDF y devolver resultado completo. maxPages=1 para identificación rápida, sin maxPages para extracción completa */
  parsePdf(pdfPath: string, maxPages?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ pdfPath, maxPages, resolve, reject });
      this.processQueue();
    });
  }

  // ── Estadísticas del pool ─────────────────────────────────────────────────
  get stats() {
    return {
      poolSize: this.slots.length,
      busy: this.slots.filter(s => s.busy).length,
      queued: this.queue.length,
    };
  }

  // ── Terminar todos los workers y limpiar la cola ──────────────────────────
  async terminate(): Promise<void> {
    // Resolver todas las tareas pendientes con null antes de terminar
    for (const task of this.queue) task.resolve(null);
    this.queue = [];
    await Promise.all(this.slots.map(s => {
      s.worker.kill();
      return Promise.resolve();
    }));
    this.slots = [];
  }
}
