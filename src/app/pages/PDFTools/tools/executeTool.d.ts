import { FileInfo } from '../../../types';
export declare function executeTool(api: any, activeTool: {
    id: string;
    name: string;
}, files: FileInfo[], outputPath: string, params: any): Promise<{
    res: any;
    successMsg: string;
}>;
