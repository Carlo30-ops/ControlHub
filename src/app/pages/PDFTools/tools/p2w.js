export async function execute(api, inputPath, outputDir, params) {
    return await api.pdfToWord({ input: inputPath, output: outputDir });
}
