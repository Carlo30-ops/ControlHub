export async function execute(api, inputPath, outputDir, params) {
    const { pageNumberPos, pageNumberStart } = params;
    return await api.addPageNumbers({ input: inputPath, output: outputDir, position: pageNumberPos, start: parseInt(pageNumberStart) });
}
