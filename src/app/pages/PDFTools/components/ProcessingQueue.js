import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/app/components/ui/button';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
export default function ProcessingQueue({ queue, onReorder, onRemove }) {
    if (queue.length === 0)
        return null;
    return (_jsx("div", { className: "space-y-2", children: queue.map((file, idx) => (_jsxs("div", { className: "flex items-center justify-between p-2 border rounded", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium", children: file.name }), _jsx("span", { className: "ml-2 text-sm text-muted-foreground", children: file.status })] }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onReorder(idx, -1), disabled: idx === 0, children: _jsx(ArrowUp, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => onReorder(idx, 1), disabled: idx === queue.length - 1, children: _jsx(ArrowDown, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => onRemove(idx), children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, file.id))) }));
}
