import React from 'react';
import { FileInfo } from '@/app/types';
interface Props {
    onFilesAdded: (files: FileInfo[]) => void;
}
export declare const FileDropZone: React.FC<Props>;
export {};
