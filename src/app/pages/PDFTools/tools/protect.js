export async function execute(api, inputPath, outputDir, params) {
    const { password } = params;
    return await api.protect({ input: inputPath, output: outputDir, password });
}
