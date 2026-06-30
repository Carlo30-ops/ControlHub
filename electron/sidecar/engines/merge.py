import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pikepdf
except ImportError:
    pass

# Constantes de configuración
MAX_MERGE_FILES = 100
MAX_TOTAL_SIZE = 500 * 1024 * 1024  # 500MB


def handle_merge(data):
    pdf = None
    try:
        files = [os.path.abspath(f) for f in data.get("files", [])]
        output = os.path.abspath(data.get("output", "merged.pdf"))
        
        # Validaciones mejoradas
        if not files:
            return {"ok": False, "error": "No se proporcionaron archivos para fusionar"}
        
        # Validar límite de archivos
        if len(files) > MAX_MERGE_FILES:
            return {"ok": False, "error": f"Máximo {MAX_MERGE_FILES} archivos permitidos. Se proporcionaron {len(files)}"}
        
        # Validar tamaño total de archivos
        total_size = 0
        for f in files:
            if os.path.exists(f):
                total_size += os.path.getsize(f)
        if total_size > MAX_TOTAL_SIZE:
            return {"ok": False, "error": f"Tamaño total excede {MAX_TOTAL_SIZE / 1024 / 1024:.0f}MB. Total: {total_size / 1024 / 1024:.1f}MB"}
        
        # Validar extensión de output
        if not output.lower().endswith('.pdf'):
            return {"ok": False, "error": "El archivo de salida debe tener extensión .pdf"}
        
        # Verificar que todos los archivos existan
        missing_files = [f for f in files if not os.path.exists(f)]
        if missing_files:
            return {"ok": False, "error": f"Archivos no encontrados: {', '.join(missing_files)}"}
        
        # Verificar que no haya archivos duplicados
        if len(files) != len(set(files)):
            return {"ok": False, "error": "Se detectaron archivos duplicados en la lista"}
        
        # Verificar que el directorio de salida existe o se puede crear
        output_dir = os.path.dirname(output)
        if output_dir and not os.path.exists(output_dir):
            try:
                os.makedirs(output_dir)
            except Exception as e:
                return {"ok": False, "error": f"No se pudo crear el directorio de salida: {str(e)}"}
        
        # Verificar que todos los archivos sean PDFs válidos y no estén protegidos
        invalid_pdfs = []
        protected_pdfs = []
        for f in files:
            try:
                with pikepdf.open(f, allow_overwriting_input=True) as test:
                    # Verificar si está protegido
                    if test.is_encrypted:
                        protected_pdfs.append(f)
            except pikepdf.PasswordError:
                protected_pdfs.append(f)
            except (pikepdf.ParseError, OSError, PermissionError) as e:
                invalid_pdfs.append(f)
            except Exception as e:
                # Loggear error inesperado pero continuar
                sys.stderr.write(f"MERGE_WARNING:Error inesperado validando {os.path.basename(f)}: {str(e)}\n")
                sys.stderr.flush()
                invalid_pdfs.append(f)
        
        if invalid_pdfs:
            return {"ok": False, "error": f"Archivos PDF inválidos o corruptos: {', '.join(invalid_pdfs)}"}
        
        if protected_pdfs:
            return {"ok": False, "error": f"Archivos PDF protegidos con contraseña (usa la herramienta 'Desbloquear PDF' primero): {', '.join(protected_pdfs)}"}
        
        # Opciones de fusión
        preserve_bookmarks = data.get("preserve_bookmarks", True)
        renumber_pages = data.get("renumber_pages", False)
        
        total_pages = 0
        pdf = pikepdf.new()
        
        for idx, f in enumerate(files):
            try:
                with pikepdf.open(f) as src:
                    page_count = len(src.pages)
                    total_pages += page_count
                    pdf.pages.extend(src.pages)
                    
                    # Reportar progreso
                    sys.stderr.write(f"MERGE_PROGRESS:{idx + 1}/{len(files)}|{page_count}\n")
                    sys.stderr.flush()
                    
                    # Preservar bookmarks si se solicita
                    if preserve_bookmarks and src.open_outline():
                        try:
                            if pdf.open_outline():
                                pdf.outline.extend(src.outline)
                            else:
                                pdf.outline = src.outline
                        except Exception as e:
                            # Loggear error específico pero no crashear
                            sys.stderr.write(f"MERGE_WARNING:Error preservando bookmarks de {os.path.basename(f)}: {str(e)}\n")
                            sys.stderr.flush()
            except Exception as e:
                return {"ok": False, "error": f"Error al procesar archivo {os.path.basename(f)}: {str(e)}"}
        
        # Renumerar páginas si se solicita (tipo iLovePDF)
        renumber_warning = None
        if renumber_pages:
            try:
                with pdf.open_outline() as outline:
                    # Eliminar page labels existentes para renumerar desde 1
                    if hasattr(pdf, 'Root') and hasattr(pdf.Root, 'PageLabels'):
                        del pdf.Root.PageLabels
                
                # Crear nueva numeración consecutiva
                page_labels = pikepdf.Dictionary()
                page_labels.Nums = pikepdf.Array()
                
                # Agregar numeración desde la página 1
                page_labels.Nums.append(0)  # Índice de página (0-based)
                label_dict = pikepdf.Dictionary()
                label_dict.S = pikepdf.Name('/D')  # Decimal (1, 2, 3...)
                label_dict.St = 1  # Iniciar en 1
                page_labels.Nums.append(label_dict)
                
                # Asignar page labels al documento
                if not hasattr(pdf.Root, 'PageLabels'):
                    pdf.Root.PageLabels = page_labels
                else:
                    pdf.Root.PageLabels = page_labels
            except Exception as e:
                # No fallar si la renumeración falla, pero advertir al usuario
                renumber_warning = f"No se pudo renumerar páginas: {str(e)}"
                sys.stderr.write(f"MERGE_WARNING:{renumber_warning}\n")
                sys.stderr.flush()
        
        pdf.save(output)
        
        # Validar que el output se creó correctamente
        if not os.path.exists(output) or os.path.getsize(output) == 0:
            return {"ok": False, "error": "El archivo de salida no se generó correctamente"}
        
        response = {
            "ok": True, 
            "output": output,
            "total_pages": total_pages,
            "files_merged": len(files)
        }
        
        # Agregar warning si la renumeración falló
        if renumber_warning:
            response["warning"] = renumber_warning
        
        return response
    except Exception as e:
        return {"ok": False, "error": f"Error en fusión de PDFs: {str(e)}"}
    finally:
        if pdf:
            try:
                pdf.close()
            except Exception:
                pass
