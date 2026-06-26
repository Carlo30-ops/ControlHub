export async function execute(api, inputPath, outputDir, params) {
    const { wmText, wmOpacity, wmAngle } = params;
    return await api.watermark({ input: inputPath, output: outputDir, text: wmText, opacity: wmOpacity[0], angle: parseInt(wmAngle) });
}
