export async function execute(api, inputPath, outputDir, params) {
    return await api.excelToPdf({ input: inputPath, output: outputDir });
}
