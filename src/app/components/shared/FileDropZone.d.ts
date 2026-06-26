interface FileDropZoneProps {
    multiple?: boolean;
    compact?: boolean;
    disabled?: boolean;
    onFiles: (paths: string[]) => void;
    onRemove?: (index: number) => void;
    onReorder?: (fromIndex: number, direction: 1 | -1) => void;
    onClear?: () => void;
    files: Array<{
        name: string;
        path: string;
    }>;
    accept?: string;
    defaultPath?: string;
    className?: string;
}
export declare function FileDropZone({ multiple, compact, disabled, onFiles, onRemove, onReorder, onClear, files, accept, defaultPath, className, }: FileDropZoneProps): import("react/jsx-runtime").JSX.Element;
export {};
