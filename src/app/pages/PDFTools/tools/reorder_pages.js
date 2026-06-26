export async function execute(api, inputPath, outputDir, params) {
    const { pageOrder } = params;
    return await api.reorderPages({ input: inputPath, output: outputDir, order: pageOrder });
}
