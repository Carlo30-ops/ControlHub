export async function execute(api, inputPath, outputDir, params) {
    const { deletePagesInput } = params;
    return await api.deletePages({ input: inputPath, output: outputDir, pages: deletePagesInput });
}
