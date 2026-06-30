import os
import sys
import tempfile
import hashlib

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import fitz  # pymupdf
except ImportError:
    pass


def handle_jpg_to_pdf(data):
    doc = None
    warnings = []
    try:
        images = [os.path.abspath(f) for f in data.get("images", [])]
        output = os.path.abspath(data.get("output", "images.pdf"))
        if not images:
            return {"ok": False, "error": "No se proporcionaron imágenes."}
        doc = fitz.open()
        for img in images:
            if not os.path.exists(img):
                warnings.append(f"Imagen no encontrada: {img}")
                continue
            img_doc = None
            try:
                img_doc = fitz.open(img)
                pdf_bytes = img_doc.convert_to_pdf()
            except Exception:
                warnings.append(f"Imagen inválida o no compatible: {img}")
                continue
            finally:
                if img_doc:
                    try:
                        img_doc.close()
                    except Exception:
                        pass
            with fitz.open("pdf", pdf_bytes) as pdf_img:
                doc.insert_pdf(pdf_img)
        if doc.page_count == 0:
            return {"ok": False, "error": "No se pudo insertar ninguna imagen válida."}
        doc.save(output)
        if not os.path.exists(output) or os.path.getsize(output) == 0:
            return {"ok": False, "error": "No se pudo generar el PDF de salida."}
        result = {"ok": True, "output": output}
        if warnings:
            result["warning"] = "; ".join(warnings)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass


def handle_pdf_to_jpg(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_dir = os.path.abspath(data.get("output_dir", "."))
        dpi = int(data.get("dpi", 150))
        if not os.path.exists(output_dir): os.makedirs(output_dir)
        doc = fitz.open(input_file)
        outputs = []
        # Soporta parámetro opcional 'pages' (1-based list) para convertir solo páginas específicas
        pages_param = data.get('pages')
        if pages_param and isinstance(pages_param, (list, tuple)) and len(pages_param) > 0:
            pages_to_render = [p for p in pages_param if isinstance(p, int) and p >= 1 and p <= doc.page_count]
        else:
            pages_to_render = list(range(1, doc.page_count + 1))

        for pnum in pages_to_render:
            i = pnum - 1
            page = doc[i]
            pix = page.get_pixmap(dpi=dpi)
            out_path = os.path.join(output_dir, f"page_{pnum}.jpg")
            pix.save(out_path)
            outputs.append(out_path)
        doc.close()
        return {"ok": True, "outputs": outputs}
    except Exception as e: return {"ok": False, "error": str(e)}


def handle_pdf_thumbnail(data):
    """
    Renderiza solo la primera página de un PDF como PNG 
    para uso como thumbnail. Retorna la ruta del PNG generado.
    """
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        dpi = int(data.get("dpi", 100))

        if not input_file or not os.path.exists(input_file):
            return {"ok": False, "error": "Archivo no encontrado."}

        doc = fitz.open(input_file)
        if doc.page_count == 0:
            return {"ok": False, "error": "El PDF no tiene páginas."}

        page = doc[0]
        pix = page.get_pixmap(dpi=dpi)

        # Guardar en temp con nombre único basado en el path del PDF
        file_hash = hashlib.md5(input_file.encode()).hexdigest()[:8]
        thumb_name = f"pdfthumb_{file_hash}.png"
        thumb_path = os.path.join(tempfile.gettempdir(), thumb_name)
        pix.save(thumb_path)

        return {"ok": True, "thumb_path": thumb_path, "page_count": doc.page_count}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass


def handle_page_thumbnails(data):
    """
    Genera miniaturas de páginas individuales de un PDF.
    Útil para UI visual estilo iLovePDF (organizar, split, etc).
    Retorna array de rutas de miniaturas.
    """
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        dpi = int(data.get("dpi", 72))  # DPI bajo para miniaturas rápidas
        pages = data.get("pages", [])  # Array de índices de páginas (0-based), vacío = todas

        if not input_file or not os.path.exists(input_file):
            return {"ok": False, "error": "Archivo no encontrado."}

        doc = fitz.open(input_file)
        page_count = doc.page_count
        
        if page_count == 0:
            return {"ok": False, "error": "El PDF no tiene páginas."}

        # Determinar qué páginas generar
        if pages and len(pages) > 0:
            page_indices = [p for p in pages if 0 <= p < page_count]
        else:
            page_indices = list(range(page_count))

        # Guardar miniaturas directamente en el directorio temp con prefijo pdfthumb_ para que
        # el protocolo custom de electron pueda servirlos sin problemas.
        file_hash = hashlib.md5(input_file.encode()).hexdigest()[:8]
        thumbnails = []
        
        for idx in page_indices:
            try:
                page = doc[idx]
                pix = page.get_pixmap(dpi=dpi)
                thumb_name = f"pdfthumb_page_{file_hash}_{idx+1}.png"
                thumb_path = os.path.join(tempfile.gettempdir(), thumb_name)
                pix.save(thumb_path)
                thumbnails.append({
                    "page_index": idx,
                    "page_number": idx + 1,
                    "thumb_path": thumb_path
                })
            except Exception as e:
                # Continuar con otras páginas si una falla
                continue

        return {
            "ok": True, 
            "thumbnails": thumbnails,
            "total_pages": page_count,
            "thumb_dir": tempfile.gettempdir()
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass


def handle_html_to_pdf(data):
    """
    Genera un PDF a partir de HTML.
    - Si `data` contiene la clave `input`, se interpreta como ruta a archivo .html (legacy).
    - Si `data` contiene la clave `html`, se interpreta como el contenido HTML en texto plano
      y en ese caso se devuelve el PDF codificado en base64 en la clave `pdf_base64`.

    Este handler evita escribir a disco cuando el renderer envía `html` (más seguro y evita
    problemas de validación de paths desde el renderer). Si se proporciona `output` y se
    valida en el main, el sidecar intentará escribirlo en disco.
    """
    try:
        # Caso 1: contenido HTML directo (preferred for IPC from renderer)
        html_content = data.get("html")
        output_file = data.get("output")
        if html_content:
            # Render HTML -> PDF en memoria
            doc = fitz.open(stream=html_content.encode("utf-8"), filetype="html")
            pdf_bytes = doc.convert_to_pdf()
            doc.close()
            try:
                import base64
                pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')
            except Exception:
                # Fallback: devolver bytes como string ISO-8859-1 (raramente usado)
                pdf_b64 = None

            # Si el caller solicitó escritura en disco, intentamos salvarlo allí también
            if output_file:
                try:
                    out_path = os.path.abspath(output_file)
                    with open(out_path, 'wb') as f:
                        f.write(pdf_bytes)
                except Exception as e_out:
                    # No fatal: seguimos devolviendo base64 y advertencia
                    return {"ok": True, "pdf_base64": pdf_b64, "warning": f"No se pudo escribir output: {str(e_out)}"}

            return {"ok": True, "pdf_base64": pdf_b64}

        # Caso 2: legacy — ruta a archivo HTML en disco
        input_file = data.get("input")
        if not input_file:
            return {"ok": False, "error": "No se proporcionó 'input' ni 'html' para html_to_pdf"}

        input_file = os.path.abspath(input_file)
        output_file = os.path.abspath(data.get("output", "html.pdf"))
        with open(input_file, "r", encoding="utf-8") as f:
            html_content = f.read()
        doc = fitz.open(stream=html_content.encode("utf-8"), filetype="html")
        pdf_bytes = doc.convert_to_pdf()
        doc.close()
        with fitz.open("pdf", pdf_bytes) as pdf:
            pdf.save(output_file)
        return {"ok": True, "output": output_file, "warning": "El renderizado HTML es básico. Para CSS avanzado usa un navegador externo."}
    except Exception as e:
        return {"ok": False, "error": str(e)}
