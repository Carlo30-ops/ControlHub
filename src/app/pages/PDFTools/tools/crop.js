export async function execute(api, inputPath, outputDir, params) {
    const { cropRect } = params;
    return await api.crop({ input: inputPath, output: outputDir, rect: [cropRect.x0, cropRect.y0, cropRect.x1, cropRect.y1] });
}
