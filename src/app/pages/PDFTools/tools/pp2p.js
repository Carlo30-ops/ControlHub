export async function execute(api, inputPath, outputDir, params) {
    return await api.pptToPdf({ input: inputPath, output: outputDir });
}
