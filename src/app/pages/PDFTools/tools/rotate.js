export async function execute(api, inputPath, outputDir, params) {
    const { rotateAngle, rotatePages } = params;
    return await api.rotate({ input: inputPath, output: outputDir, angle: parseInt(rotateAngle), pages: rotatePages });
}
