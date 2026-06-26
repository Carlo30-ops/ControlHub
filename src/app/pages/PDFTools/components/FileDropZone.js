import { jsx as _jsx } from "react/jsx-runtime";
import { FileDropZone as SharedFileDropZone } from '@/app/components/shared/FileDropZone';
export const FileDropZone = ({ onFilesAdded }) => {
    const handleFiles = (paths) => {
        const files = paths.map((p) => ({
            name: p.split(/[\\/]/).pop() ?? '',
            path: p,
        }));
        onFilesAdded(files);
    };
    // Use the shared FileDropZone component, forwarding the onFiles callback.
    return (_jsx(SharedFileDropZone, { multiple: true, onFiles: handleFiles, files: [], onRemove: undefined, onReorder: undefined, onClear: undefined, accept: undefined, defaultPath: undefined, className: undefined }));
};
