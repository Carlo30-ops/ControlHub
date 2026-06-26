import { FileInfo } from '../../../types';
import { toast } from 'sonner';

import { FileInfo } from '../../../types';
import { toast } from 'sonner';

// Import individual tool functions (one file per tool)
import { merge } from './merge';
import { split } from './split';
import { extract } from './extract';
import { deletePages } from './delete_pages';
import { reorder_pages } from './reorder_pages';
import { compress } from './compress';
import { rotate } from './rotate';
import { crop } from './crop';
import { repair } from './repair';
import { add_page_numbers } from './add_page_numbers';
import { watermark } from './watermark';
import { watermark_image } from './watermark_image';
import { jpg_to_pdf } from './jpg_to_pdf';
import { pdf_to_jpg } from './pdf_to_jpg';
import { html_to_pdf } from './html_to_pdf';
import { protect } from './protect';
import { unlock } from './unlock';
import { ocr } from './ocr';
import { w2p } from './w2p';
import { p2w } from './p2w';
import { e2p } from './e2p';
import { pp2p } from './pp2p';

export async function executeTool(
  api: any,
  activeTool: { id: string; name: string },
  files: FileInfo[],
  outputPath: string,
  params: any
): Promise<{ res: any; successMsg: string }> {
  // Map tool IDs to the corresponding imported function
  const toolMap: Record<string, Function> = {
    merge,
    split,
    extract,
    delete_pages: deletePages,
    reorder_pages,
    compress,
    rotate,
    crop,
    repair,
    add_page_numbers,
    watermark,
    watermark_image,
    jpg_to_pdf,
    pdf_to_jpg,
    html_to_pdf,
    protect,
    unlock,
    ocr,
    w2p,
    p2w,
    e2p,
    pp2p,
  };

  const executor = toolMap[activeTool.id];
  if (!executor) {
    const errMsg = `No executor defined for tool: ${activeTool.id}`;
    toast.error(`Error al ejecutar ${activeTool.name}: ${errMsg}`);
    throw new Error(errMsg);
  }

  try {
    // All tool functions share the same signature: (api, files, outputPath, params)
    const res = await executor(api, files, outputPath, params);
    const successMsg = `${activeTool.name} completado correctamente`;
    return { res, successMsg };
  } catch (err: any) {
    toast.error(`Error al ejecutar ${activeTool.name}: ${err.message}`);
    throw err;
  }
}
