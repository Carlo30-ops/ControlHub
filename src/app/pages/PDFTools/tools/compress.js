export async function execute(api, inputPath, outputDir, params) {
    const { compressLevel } = params;
    return await api.compress({ input: inputPath, output: outputDir, level: compressLevel });
}
