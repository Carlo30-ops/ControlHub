import { toast } from 'sonner';
export async function executeTool(api, activeTool, files, outputPath, params) {
    const input = files[0]?.path ?? '';
    let res;
    try {
        switch (activeTool.id) {
            case 'split':
                res = await api.split({ input, output_dir: outputPath, ranges: params.splitRanges });
                break;
            case 'extract':
                res = await api.extract({ input, output: outputPath, pages: params.extractPages });
                break;
            case 'delete_pages':
                res = await api.deletePages({ input, output: outputPath, pages: params.deletePagesInput });
                break;
            case 'reorder_pages':
                res = await api.reorderPages({ input, output: outputPath, order: params.pageOrder });
                break;
            case 'compress':
                res = await api.compress({ input, output: outputPath, level: params.compressLevel });
                break;
            case 'rotate':
                res = await api.rotate({
                    input,
                    output: outputPath,
                    angle: parseInt(params.rotateAngle ?? '90'),
                    pages: params.rotatePages,
                });
                break;
            case 'crop':
                res = await api.crop({
                    input,
                    output: outputPath,
                    rect: [
                        params.cropRect?.x0 ?? 0,
                        params.cropRect?.y0 ?? 0,
                        params.cropRect?.x1 ?? 595,
                        params.cropRect?.y1 ?? 842,
                    ],
                });
                break;
            case 'repair':
                res = await api.repair({ input, output: outputPath });
                break;
            case 'add_page_numbers':
                res = await api.addPageNumbers({
                    input,
                    output: outputPath,
                    position: params.pageNumberPos,
                    start: parseInt(params.pageNumberStart ?? '1'),
                });
                break;
            case 'watermark':
                res = await api.watermark({
                    input,
                    output: outputPath,
                    text: params.wmText,
                    opacity: params.wmOpacity?.[0] ?? 0.3,
                    angle: parseInt(params.wmAngle ?? '45'),
                });
                break;
            case 'watermark_image':
                res = await api.watermarkImage({
                    input,
                    output: outputPath,
                    image: params.wmImage?.path,
                    opacity: params.wmOpacity?.[0] ?? 0.3,
                });
                break;
            case 'jpg_to_pdf':
                res = await api.jpgToPdf({ input, output: outputPath });
                break;
            case 'pdf_to_jpg':
                res = await api.pdfToJpg({
                    input,
                    output_dir: outputPath,
                    dpi: parseInt(params.dpi ?? '150'),
                });
                break;
            case 'html_to_pdf':
                res = await api.htmlToPdf({ input, output: outputPath });
                break;
            case 'protect':
                res = await api.protect({ input, output: outputPath, password: params.password });
                break;
            case 'unlock':
                res = await api.unlock({ input, output: outputPath, password: params.password });
                break;
            case 'ocr':
                res = await api.ocr({ input, output: outputPath, lang: params.ocrLang });
                break;
            case 'merge':
                res = await api.merge({ inputs: files.map((f) => f.path), output: outputPath });
                break;
            case 'w2p':
                res = await api.wordToPdf({ input, output: outputPath });
                break;
            case 'p2w':
                res = await api.pdfToWord({ input, output: outputPath });
                break;
            case 'e2p':
                res = await api.excelToPdf({ input, output: outputPath });
                break;
            case 'pp2p':
                res = await api.pptToPdf({ input, output: outputPath });
                break;
            default:
                throw new Error(`No executor defined for tool: ${activeTool.id}`);
        }
        const successMsg = `${activeTool.name} completado correctamente`;
        return { res, successMsg };
    }
    catch (err) {
        toast.error(`Error al ejecutar ${activeTool.name}: ${err.message}`);
        throw err;
    }
}
/**
 * Centralised executor called by usePdfTool.
 * Returns { res, successMsg } so the hook can handle state uniformly.
 */
export async function executeTool(api, activeTool, files, outputPath, params) {
    const input = files[0]?.path ?? '';
    let res;
    switch (activeTool.id) {
        case 'split':
            res = await api.split({ input, output_dir: outputPath, ranges: params.splitRanges });
            break;
        case 'extract':
            res = await api.extract({ input, output: outputPath, pages: params.extractPages });
            break;
        case 'delete_pages':
            res = await api.deletePages({ input, output: outputPath, pages: params.deletePagesInput });
            break;
        case 'reorder_pages':
            res = await api.reorderPages({ input, output: outputPath, order: params.pageOrder });
            break;
        case 'compress':
            res = await api.compress({ input, output: outputPath, level: params.compressLevel });
            break;
        case 'rotate':
            res = await api.rotate({
                input,
                output: outputPath,
                angle: parseInt(params.rotateAngle ?? '90'),
                pages: params.rotatePages,
            });
            break;
        case 'crop':
            res = await api.crop({
                input,
                output: outputPath,
                rect: [
                    params.cropRect?.x0 ?? 0,
                    params.cropRect?.y0 ?? 0,
                    params.cropRect?.x1 ?? 595,
                    params.cropRect?.y1 ?? 842,
                ],
            });
            break;
        case 'repair':
            res = await api.repair({ input, output: outputPath });
            break;
        case 'add_page_numbers':
            res = await api.addPageNumbers({
                input,
                output: outputPath,
                position: params.pageNumberPos,
                start: parseInt(params.pageNumberStart ?? '1'),
            });
            break;
        case 'watermark':
            res = await api.watermark({
                input,
                output: outputPath,
                text: params.wmText,
                opacity: params.wmOpacity?.[0] ?? 0.3,
                angle: parseInt(params.wmAngle ?? '45'),
            });
            break;
        case 'watermark_image':
            res = await api.watermarkImage({
                input,
                output: outputPath,
                image: params.wmImage?.path,
                opacity: params.wmOpacity?.[0] ?? 0.3,
            });
            break;
        case 'jpg_to_pdf':
            res = await api.jpgToPdf({ input, output: outputPath });
            break;
        case 'pdf_to_jpg':
            res = await api.pdfToJpg({
                input,
                output_dir: outputPath,
                dpi: parseInt(params.dpi ?? '150'),
            });
            break;
        case 'html_to_pdf':
            res = await api.htmlToPdf({ input, output: outputPath });
            break;
        case 'protect':
            res = await api.protect({ input, output: outputPath, password: params.password });
            break;
        case 'unlock':
            res = await api.unlock({ input, output: outputPath, password: params.password });
            break;
        case 'ocr':
            res = await api.ocr({ input, output: outputPath, lang: params.ocrLang });
            break;
        case 'merge':
            res = await api.merge({ inputs: files.map((f) => f.path), output: outputPath });
            break;
        case 'w2p':
            res = await api.wordToPdf({ input, output: outputPath });
            break;
        case 'p2w':
            res = await api.pdfToWord({ input, output: outputPath });
            break;
        case 'e2p':
            res = await api.excelToPdf({ input, output: outputPath });
            break;
        case 'pp2p':
            res = await api.pptToPdf({ input, output: outputPath });
            break;
        default:
            throw new Error(`No executor defined for tool: ${activeTool.id}`);
    }
    const successMsg = `${activeTool.name} completado correctamente`;
    return { res, successMsg };
}
