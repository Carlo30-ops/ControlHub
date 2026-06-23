import React from 'react';
import { FileDropZone as SharedFileDropZone } from '@/app/components/shared/FileDropZone';
import { FileInfo } from '@/app/types';

interface Props {
  onFilesAdded: (files: FileInfo[]) => void;
}

export const FileDropZone: React.FC<Props> = ({ onFilesAdded }) => {
  const handleFiles = (paths: string[]) => {
    const files: FileInfo[] = paths.map((p) => ({
      name: p.split(/[\\/]/).pop() ?? '',
      path: p,
    }));
    onFilesAdded(files);
  };

  // Use the shared FileDropZone component, forwarding the onFiles callback.
  return (
    <SharedFileDropZone
      multiple
      onFiles={handleFiles}
      files={[]}
      onRemove={undefined}
      onReorder={undefined}
      onClear={undefined}
      accept={undefined}
      defaultPath={undefined}
      className={undefined}
    />
  );
};
