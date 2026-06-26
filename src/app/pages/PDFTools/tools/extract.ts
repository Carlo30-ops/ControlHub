export async function execute(api: any, inputPath: string, outputDir: string, params: any) {
  const { extractPages } = params;
  return await api.extract({ input: inputPath, output: outputDir, pages: extractPages });
}
