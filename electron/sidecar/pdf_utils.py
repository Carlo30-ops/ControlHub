import os
import shutil

try:
    import pytesseract
except ImportError:
    pytesseract = None


def resolve_ghostscript_path(user_path=None):
    """Busca el ejecutable de Ghostscript en orden de prioridad."""
    # 1. Ruta configurada por el usuario
    if user_path and os.path.exists(user_path):
        return user_path
        
    # 2. Rutas comunes en Windows
    common_paths = [
        r'C:\Program Files\gs\gs10.03.1\bin\gswin64c.exe',
        r'C:\Program Files\gs\gs10.03.1\bin\gswin32c.exe',
        r'C:\Program Files\gs\gs10.02.1\bin\gswin64c.exe',
        r'C:\Program Files\gs\gs10.02.1\bin\gswin32c.exe',
        r'C:\Program Files\gs\gs10.01.2\bin\gswin64c.exe',
        r'C:\Program Files\gs\gs10.01.2\bin\gswin32c.exe',
        r'C:\Program Files\gs\gs9.56.0\bin\gswin64c.exe',
        r'C:\Program Files\gs\gs9.56.0\bin\gswin32c.exe',
        r'C:\Program Files (x86)\gs\gs10.03.1\bin\gswin64c.exe',
        r'C:\Program Files (x86)\gs\gs10.03.1\bin\gswin32c.exe',
    ]
    for p in common_paths:
        if os.path.exists(p): return p
        
    # 3. Buscar en el PATH del sistema
    path_in_env = shutil.which("gswin64c") or shutil.which("gswin32c") or shutil.which("gs")
    if path_in_env: return path_in_env
    
    return None


def resolve_tesseract_path(user_path=None):
    """Busca el ejecutable de Tesseract OCR en orden de prioridad."""
    if not pytesseract:
        return None
    
    # 1. Ruta configurada por el usuario
    if user_path and os.path.exists(user_path):
        return user_path
        
    # 2. Rutas comunes en Windows
    common_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        r'C:\Users\{}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe'.format(os.getenv('USERNAME', '')),
    ]
    for p in common_paths:
        if os.path.exists(p): return p
        
    # 3. Buscar en el PATH del sistema
    path_in_env = shutil.which("tesseract")
    if path_in_env: return path_in_env
    
    return None


def parse_pages_param(param_str, page_count):
    """
    Parsea un parámetro de páginas (ej: "1,3,5-7,10-z") y retorna índices 0-based.
    Soporta:
    - Páginas individuales: "1,3,5"
    - Rangos: "5-7"
    - Rango hasta el final: "10-z"
    - Combinaciones: "1,3,5-7,10-z"
    """
    if not param_str or not param_str.strip():
        return []
    
    indices = []
    parts = param_str.split(',')
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
            
        if '-' in part:
            # Rango: "5-7" o "10-z"
            s, e = part.split('-')
            start = int(s)
            end = page_count if e.lower() == 'z' else int(e)
            indices.extend(range(start, end + 1))
        else:
            # Página individual
            indices.append(int(part))
    
    # Filtrar válidos y remover duplicados
    return sorted(list(set([i - 1 for i in indices if 1 <= i <= page_count])))
