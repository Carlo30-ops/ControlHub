export async function execute(api, inputPath, outputDir, params) {
    const { password } = params;
    return await api.unlock({ input: inputPath, output: outputDir, password });
}
