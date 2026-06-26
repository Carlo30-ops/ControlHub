export interface FileInfo {
    path: string;
    name: string;
    size?: string;
}
export interface QueuedFile extends FileInfo {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    outputPath?: string;
    errorMessage?: string;
    progress?: number;
}
/**
 * Hook that encapsulates the sequential queue logic previously embedded in PDFTools/index.tsx.
 * It provides the queue reference, a tick counter to force re‑renders, and helpers to reorder or
 * remove items from the queue.
 */
export declare function useFileQueue(initialFiles?: FileInfo[]): {
    fileQueueRef: import("react").MutableRefObject<FileInfo[]>;
    setQueueFiles: (nextFiles: FileInfo[]) => void;
    handleQueueReorder: (idx: number, dir: number) => void;
    handleQueueRemove: (idx: number) => void;
    readonly fileQueue: FileInfo[];
};
