export async function execute(api, inputPath, outputDir, params) {
    const { ocrLang } = params;
    return await api.ocr({ input: inputPath, output: outputDir, lang: ocrLang });
}
