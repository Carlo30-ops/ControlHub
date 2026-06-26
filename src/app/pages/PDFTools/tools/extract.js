export async function execute(api, inputPath, outputDir, params) {
    const { extractPages } = params;
    return await api.extract({ input: inputPath, output: outputDir, pages: extractPages });
}
