export async function execute(api, inputPath, outputDir, params) {
    return await api.wordToPdf({ input: inputPath, output: outputDir });
}
