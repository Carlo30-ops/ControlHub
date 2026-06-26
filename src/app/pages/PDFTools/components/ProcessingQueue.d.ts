import { QueuedFile } from '@/app/pages/PDFTools/hooks/useFileQueue';
interface Props {
    queue: QueuedFile[];
    onReorder: (idx: number, dir: number) => void;
    onRemove: (idx: number) => void;
}
export default function ProcessingQueue({ queue, onReorder, onRemove }: Props): import("react/jsx-runtime").JSX.Element | null;
export {};
