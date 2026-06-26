export async function execute(api, inputPath, outputDir, params) {
    const { dpi } = params;
    return await api.pdfToJpg({ input: inputPath, output_dir: outputDir, dpi: parseInt(dpi) });
}
