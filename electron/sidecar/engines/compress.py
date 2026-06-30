import os
import sys
import subprocess

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pikepdf
    import fitz  # pymupdf
except ImportError:
    pass

# Importar utilidades compartidas
from pdf_utils import resolve_ghostscript_path


def handle_compress(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "compressed.pdf"))
        level = data.get("level", "screen")
        ghostscript_path = data.get("ghostscript_path")
        
        # Validaciones mejoradas
        if not input_file:
            return {"ok": False, "error": "No se proporcionó archivo de entrada"}
        
        if not os.path.exists(input_file):
            return {"ok": False, "error": f"Archivo de entrada no encontrado: {input_file}"}
        
        # Validar nivel de compresión
        valid_levels = ["screen", "ebook", "printer", "prepress", "default", "fast"]
        if level not in valid_levels:
            return {"ok": False, "error": f"Nivel de compresión inválido: {level}. Valores válidos: {', '.join(valid_levels)}"}
        
        # Verificar directorio de salida
        output_dir = os.path.dirname(output_file)
        if output_dir and not os.path.exists(output_dir):
            try:
                os.makedirs(output_dir)
            except Exception as e:
                return {"ok": False, "error": f"No se pudo crear el directorio de salida: {str(e)}"}
        
        # Validar que sea un PDF válido
        try:
            with pikepdf.open(input_file) as test_pdf:
                pass
        except Exception as e:
            return {"ok": False, "error": f"El archivo de entrada no es un PDF válido o está corrupto: {str(e)}"}
        
        # Obtener tamaño original para comparación
        original_size = os.path.getsize(input_file)
        
        # Reportar inicio de compresión
        sys.stderr.write(f"COMPRESS_PROGRESS:start|{level}|{original_size}\n")
        sys.stderr.flush()
        
        if level == "fast":
            sys.stderr.write("COMPRESS_PROGRESS:engine|pikepdf-fast\n")
            sys.stderr.flush()
            
            with pikepdf.open(input_file) as pdf:
                pdf.save(output_file, linearize=True)
            
            # Validar output
            if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
                return {"ok": False, "error": "El archivo comprimido no se generó correctamente"}
            
            compressed_size = os.path.getsize(output_file)
            reduction = ((original_size - compressed_size) / original_size * 100) if original_size > 0 else 0
            
            sys.stderr.write("COMPRESS_PROGRESS:complete\n")
            sys.stderr.flush()
            
            return {
                "ok": True, 
                "output": output_file, 
                "engine": "pikepdf-fast",
                "original_size": original_size,
                "compressed_size": compressed_size,
                "reduction_percent": round(reduction, 2)
            }
        
        gs_cmd = resolve_ghostscript_path(ghostscript_path)
        if not gs_cmd:
            sys.stderr.write("COMPRESS_PROGRESS:fallback|fitz\n")
            sys.stderr.flush()
            
            # Fallback 1: PyMuPDF (mejor compresión de imágenes)
            try:
                doc = fitz.open(input_file)
                doc.save(output_file, 
                         garbage=4,      # elimina objetos no referenciados
                         deflate=True,   # comprime streams
                         clean=True)     # limpia estructura
                doc.close()
                doc = None
                
                if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
                    return {"ok": False, "error": "El archivo comprimido no se generó correctamente"}
                
                compressed_size = os.path.getsize(output_file)
                reduction = ((original_size - compressed_size) / original_size * 100) if original_size > 0 else 0
                
                sys.stderr.write("COMPRESS_PROGRESS:complete\n")
                sys.stderr.flush()
                
                return {
                    "ok": True, 
                    "output": output_file, 
                    "engine": "fitz-fallback",
                    "warning": "Ghostscript no encontrado. Compresión via PyMuPDF.",
                    "original_size": original_size,
                    "compressed_size": compressed_size,
                    "reduction_percent": round(reduction, 2)
                }
            except Exception as e_fitz:
                sys.stderr.write(f"COMPRESS_PROGRESS:fallback|pikepdf|error:{str(e_fitz)}\n")
                sys.stderr.flush()
                pass
            
            # Fallback 2: pikepdf básico (último recurso)
            try:
                with pikepdf.open(input_file) as pdf:
                    pdf.save(output_file, compress_streams=True, linearize=True)
                
                if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
                    return {"ok": False, "error": "El archivo comprimido no se generó correctamente"}
                
                compressed_size = os.path.getsize(output_file)
                reduction = ((original_size - compressed_size) / original_size * 100) if original_size > 0 else 0
                
                sys.stderr.write("COMPRESS_PROGRESS:complete\n")
                sys.stderr.flush()
                
                return {
                    "ok": True, 
                    "output": output_file, 
                    "engine": "pikepdf-fallback",
                    "warning": "Ghostscript no encontrado. Compresión básica aplicada.",
                    "original_size": original_size,
                    "compressed_size": compressed_size,
                    "reduction_percent": round(reduction, 2)
                }
            except Exception as e_pikepdf:
                return {"ok": False, "error": f"Todos los motores de compresión fallaron: {str(e_pikepdf)}"}

        # Usar Ghostscript
        sys.stderr.write("COMPRESS_PROGRESS:engine|ghostscript\n")
        sys.stderr.flush()
        
        settings = f"/{level}" if not level.startswith("/") else level
        cmd = [gs_cmd, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", f"-dPDFSETTINGS={settings}", 
               "-dNOPAUSE", "-dQUIET", "-dBATCH", f"-sOutputFile={output_file}", input_file]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return {"ok": False, "error": f"Ghostscript falló: {result.stderr}"}
        
        if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
            return {"ok": False, "error": "El archivo comprimido no se generó correctamente"}
        
        compressed_size = os.path.getsize(output_file)
        reduction = ((original_size - compressed_size) / original_size * 100) if original_size > 0 else 0
        
        sys.stderr.write("COMPRESS_PROGRESS:complete\n")
        sys.stderr.flush()
        
        return {
            "ok": True, 
            "output": output_file, 
            "engine": "ghostscript",
            "original_size": original_size,
            "compressed_size": compressed_size,
            "reduction_percent": round(reduction, 2)
        }
    except Exception as e:
        return {"ok": False, "error": f"Error en compresión de PDF: {str(e)}"}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass
