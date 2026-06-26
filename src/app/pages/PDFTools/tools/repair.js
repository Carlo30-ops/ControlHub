export async function execute(api, inputPath, outputDir, params) {
    return await api.repair({ input: inputPath, output: outputDir });
}
