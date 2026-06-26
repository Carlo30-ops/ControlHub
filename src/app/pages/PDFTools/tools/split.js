export async function splitTool(api, input, output, params) { return await api.split({ input, output_dir: output, ranges: params.ranges }); }
