export async function execute(api, inputPath, outputDir, params) {
    // Assuming jpg_to_pdf uses same api method (adjust if different)
    return await api.jpgToPdf({ input: inputPath, output: outputDir });
}
