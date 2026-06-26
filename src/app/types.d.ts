export interface FileInfo {
    path: string;
    name: string;
    size?: string;
}
export interface ToolConfig {
    id: string;
    name: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
    accept: string;
    category: string;
    newExt?: string;
    needsConfirm?: boolean;
}
