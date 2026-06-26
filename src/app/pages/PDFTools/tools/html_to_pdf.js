export async function execute(api, inputPath, outputDir, params) {
    return await api.htmlToPdf({ input: inputPath, output: outputDir });
}
