export async function splitTool(api: any, input: string, output: string, params: any) { return await api.split({ input, output_dir: output, ranges: params.ranges }); }
