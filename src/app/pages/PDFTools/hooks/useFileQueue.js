import { useRef, useState } from 'react';
/**
 * Hook that encapsulates the sequential queue logic previously embedded in PDFTools/index.tsx.
 * It provides the queue reference, a tick counter to force re‑renders, and helpers to reorder or
 * remove items from the queue.
 */
export function useFileQueue(initialFiles = []) {
    const fileQueueRef = useRef(initialFiles);
    const [, setQueueTick] = useState(0);
    const setQueueFiles = (nextFiles) => {
        fileQueueRef.current = nextFiles;
        setQueueTick((tick) => tick + 1);
    };
    const handleQueueReorder = (idx, dir) => {
        const next = [...fileQueueRef.current];
        const target = idx + dir;
        if (target < 0 || target >= next.length)
            return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setQueueFiles(next);
    };
    const handleQueueRemove = (idx) => {
        const next = [...fileQueueRef.current];
        next.splice(idx, 1);
        setQueueFiles(next);
    };
    return {
        fileQueueRef,
        setQueueFiles,
        handleQueueReorder,
        handleQueueRemove,
        // expose the current queue for rendering
        get fileQueue() {
            return fileQueueRef.current;
        },
    };
}
