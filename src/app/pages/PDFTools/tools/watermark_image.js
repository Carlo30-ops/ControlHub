export async function execute(api, inputPath, outputDir, params) {
    const { wmImage, wmOpacity } = params;
    return await api.watermarkImage({ input: inputPath, output: outputDir, image: wmImage?.path, opacity: wmOpacity[0] });
}
