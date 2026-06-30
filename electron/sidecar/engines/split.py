import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import fitz  # pymupdf
except ImportError:
    pass


def handle_split(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        # Soportar tanto output_dir (legacy) como output (nuevo con nombre base)
        output_dir = os.path.abspath(data.get("output_dir", "."))
        output_path = data.get("output", "")
        base_name = ""
        
        if output_path:
            # Si se proporciona una ruta de archivo completa, extraer directorio y nombre base
            output_path = os.path.abspath(output_path)
            output_dir = os.path.dirname(output_path)
            base_name = os.path.splitext(os.path.basename(output_path))[0]
        else:
            # Usar output_dir como antes (legacy)
            output_dir = os.path.abspath(output_dir)
        
        ranges = data.get("ranges", "")
        naming_pattern = data.get("naming_pattern", "part") # 'part', 'range', 'custom'
        
        # Validaciones mejoradas
        if not input_file:
            return {"ok": False, "error": "No se proporcionó archivo de entrada"}
        
        if not os.path.exists(input_file):
            return {"ok": False, "error": f"Archivo de entrada no encontrado: {input_file}"}
        
        if not ranges or not ranges.strip():
            return {"ok": False, "error": "No se especificaron rangos de páginas válidos"}
        
        # Crear directorio de salida si no existe
        if not os.path.exists(output_dir):
            try:
                os.makedirs(output_dir)
            except Exception as e:
                return {"ok": False, "error": f"No se pudo crear el directorio de salida: {str(e)}"}
        
        # Validar que sea un PDF válido y no esté protegido
        try:
            doc = fitz.open(input_file)
            if doc.needs_pass:
                doc.close()
                return {"ok": False, "error": "El PDF está protegido con contraseña. Usa la herramienta 'Desbloquear PDF' primero."}
        except Exception:
            return {"ok": False, "error": "El archivo de entrada no es un PDF válido o está corrupto"}
        
        page_count = doc.page_count
        range_list = [r.strip() for r in ranges.split(",") if r.strip()]
        
        if not range_list:
            return {"ok": False, "error": "No se especificaron rangos de páginas válidos"}
        
        # Validar rangos contra el número de páginas
        invalid_ranges = []
        for r in range_list:
            try:
                if "-" in r:
                    s_s, e_s = r.split("-")
                    start = int(s_s)
                    end = page_count if e_s.lower() == 'z' else int(e_s)
                    if start < 1 or start > page_count:
                        invalid_ranges.append(f"{r} (página {start} fuera de rango)")
                    if end != page_count and (end < 1 or end > page_count):
                        invalid_ranges.append(f"{r} (página {end} fuera de rango)")
                else:
                    page_num = int(r)
                    if page_num < 1 or page_num > page_count:
                        invalid_ranges.append(f"{r} (página {page_num} fuera de rango)")
            except ValueError:
                invalid_ranges.append(f"{r} (formato inválido)")
        
        if invalid_ranges:
            return {"ok": False, "error": f"Rangos inválidos: {', '.join(invalid_ranges)}. El PDF tiene {page_count} páginas."}
        
        outputs = []
        total_pages_split = 0
        
        for idx, r in enumerate(range_list):
            new_doc = None
            try:
                if "-" in r:
                    s_s, e_s = r.split("-")
                    start = int(s_s) - 1
                    end = page_count - 1 if e_s.lower() == 'z' else int(e_s) - 1
                    range_pages = end - start + 1
                else:
                    start = end = int(r) - 1
                    range_pages = 1
                
                # Generar nombre de archivo según patrón
                # Usar base_name si está disponible, sino usar prefijo por defecto
                prefix = f"{base_name}_" if base_name else ""
                
                if naming_pattern == "range":
                    safe_range = r.replace("-", "_to_").replace("/", "_")
                    out_part = os.path.join(output_dir, f"{prefix}split_{safe_range}.pdf")
                elif naming_pattern == "custom":
                    out_part = os.path.join(output_dir, f"{prefix}split_{idx+1:03d}.pdf")
                else: # part
                    out_part = os.path.join(output_dir, f"{prefix}part_{idx+1}_{r.replace('-', '_')}.pdf")
                
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start, to_page=end)
                new_doc.save(out_part)
                
                if os.path.exists(out_part) and os.path.getsize(out_part) > 0:
                    outputs.append(out_part)
                    total_pages_split += range_pages
                    
                    # Reportar progreso
                    sys.stderr.write(f"SPLIT_PROGRESS:{idx + 1}/{len(range_list)}|{range_pages}\n")
                    sys.stderr.flush()
                else:
                    return {"ok": False, "error": f"No se pudo generar el archivo para rango {r}"}
            finally:
                if new_doc:
                    try:
                        new_doc.close()
                    except Exception:
                        pass
        
        if not outputs:
            return {"ok": False, "error": "No se generaron archivos de salida"}
        
        return {
            "ok": True, 
            "outputs": outputs,
            "total_parts": len(outputs),
            "total_pages_split": total_pages_split,
            "original_page_count": page_count
        }
    except Exception as e:
        return {"ok": False, "error": f"Error en división de PDF: {str(e)}"}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass
