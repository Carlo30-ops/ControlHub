import sys
import os
import traceback

try:
    import json
    import subprocess
    import pythoncom
    import win32com.client
# from pdf2docx import Converter  # lazy import moved inside function
    import pikepdf
    import fitz  # pymupdf
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        pytesseract = None

    # Redirigir cualquier output inesperado de librerías a stderr
    # para que no contamine el canal JSON de stdout
    import io
    sys.stdout.reconfigure(encoding='utf-8')
    _true_stdout = sys.stdout
    sys.stdout = sys.stderr
    os.environ['PYTHONWARNINGS'] = 'ignore'

    # Wrapper para asegurar que solo JSON válido va a stdout
    def send_response(data, request_id=None):
        if request_id is not None:
            data['id'] = request_id
        _true_stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
        _true_stdout.flush()

    def resolve_tesseract_path(user_path=None):
        """Busca el ejecutable de Tesseract en orden de prioridad."""
        if not pytesseract: return None
        
        # 1. Ruta configurada por el usuario
        if user_path and os.path.exists(user_path):
            return user_path
            
        # 2. Rutas comunes en Windows
        common_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Users\{}\AppData\Local\Tesseract-OCR\tesseract.exe'.format(os.getlogin()),
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'
        ]
        for p in common_paths:
            if os.path.exists(p): return p
            
        # 3. Buscar en el PATH del sistema (funciona en Win/Mac/Linux si está instalado)
        import shutil
        path_in_env = shutil.which("tesseract")
        if path_in_env: return path_in_env
        
        return None

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
        import shutil
        path_in_env = shutil.which("gswin64c") or shutil.which("gswin32c") or shutil.which("gs")
        if path_in_env: return path_in_env
        
        return None

    # --- Helpers ---
    # ... (rest of the file content)
except Exception as e:
    sys.stderr.write(f"ERROR CRITICO EN PDF BRIDGE: {traceback.format_exc()}\n")
    sys.stderr.flush()
    sys.exit(1)

def parse_pages_param(pages_str, page_count):
    """Parse common page strings: '1, 3, 5-8' or '' for all."""
    if not pages_str or pages_str.strip() == "" or pages_str == "1-z":
        return list(range(page_count))
    
    indices = []
    for part in pages_str.split(","):
        part = part.strip()
        if "-" in part:
            s, e = part.split("-")
            start = int(s) - 1
            end = page_count if e.lower() == 'z' else int(e)
            indices.extend(range(start, end))
        else:
            indices.append(int(part) - 1)
    # Filtrar válidos y remover duplicados
    return sorted(list(set([i for i in indices if 0 <= i < page_count])))

# --- Handlers ---

def handle_merge(data):
    try:
        files = [os.path.abspath(f) for f in data.get("files", [])]
        output = os.path.abspath(data.get("output", "merged.pdf"))
        if not files: return {"ok": False, "error": "No se proporcionaron archivos"}
        pdf = pikepdf.new()
        for f in files:
            with pikepdf.open(f) as src:
                pdf.pages.extend(src.pages)
        pdf.save(output)
        pdf.close()
        return {"ok": True, "output": output}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_compress(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "compressed.pdf"))
        level = data.get("level", "screen")
        ghostscript_path = data.get("ghostscript_path")
        
        if level == "fast":
            with pikepdf.open(input_file) as pdf:
                pdf.save(output_file, linearize=True)
            return {"ok": True, "output": output_file, "engine": "pikepdf-fast"}
        
        gs_cmd = resolve_ghostscript_path(ghostscript_path)
        if not gs_cmd:
            # Fallback 1: PyMuPDF (mejor compresión de imágenes)
            try:
                doc = fitz.open(input_file)
                doc.save(output_file, 
                         garbage=4,      # elimina objetos no referenciados
                         deflate=True,   # comprime streams
                         clean=True)     # limpia estructura
                doc.close()
                return {"ok": True, "output": output_file, 
                        "engine": "fitz-fallback",
                        "warning": "Ghostscript no encontrado. Compresión via PyMuPDF."}
            except Exception as e_fitz:
                pass
            # Fallback 2: pikepdf básico (último recurso)
            with pikepdf.open(input_file) as pdf:
                pdf.save(output_file, compress_streams=True, linearize=True)
            return {"ok": True, "output": output_file, 
                    "engine": "pikepdf-fallback",
                    "warning": "Ghostscript no encontrado. Compresión básica aplicada."}

        settings = f"/{level}" if not level.startswith("/") else level
        cmd = [gs_cmd, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", f"-dPDFSETTINGS={settings}", 
               "-dNOPAUSE", "-dQUIET", "-dBATCH", f"-sOutputFile={output_file}", input_file]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0: return {"ok": False, "error": result.stderr}
        return {"ok": True, "output": output_file, "engine": "ghostscript"}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_split(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_dir = os.path.abspath(data.get("output_dir", "."))
        ranges = data.get("ranges", "")
        if not input_file:
            return {"ok": False, "error": "No se proporcionó archivo de entrada."}
        if not ranges or not ranges.strip():
            return {"ok": False, "error": "No se especificaron rangos de páginas válidos."}
        if not os.path.exists(output_dir): os.makedirs(output_dir)
        doc = fitz.open(input_file)
        range_list = [r.strip() for r in ranges.split(",") if r.strip()]
        if not range_list:
            return {"ok": False, "error": "No se especificaron rangos de páginas válidos."}
        outputs = []
        for idx, r in enumerate(range_list):
            out_part = os.path.join(output_dir, f"part_{idx+1}_{r.replace('-', '_')}.pdf")
            new_doc = None
            try:
                if "-" in r:
                    s_s, e_s = r.split("-")
                    start = int(s_s) - 1
                    end = doc.page_count - 1 if e_s.lower() == 'z' else int(e_s) - 1
                else:
                    start = end = int(r) - 1
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start, to_page=end)
                new_doc.save(out_part)
                if os.path.exists(out_part) and os.path.getsize(out_part) > 0:
                    outputs.append(out_part)
            finally:
                if new_doc:
                    try:
                        new_doc.close()
                    except Exception:
                        pass
        if not outputs:
            return {"ok": False, "error": "No se generaron archivos de salida."}
        return {"ok": True, "outputs": outputs}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def handle_rotate(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "rotated.pdf"))
        angle = int(data.get("angle", 90))
        if not input_file:
            return {"ok": False, "error": "No se proporcionó archivo de entrada."}
        doc = fitz.open(input_file)
        page_indices = parse_pages_param(data.get("pages", ""), doc.page_count)
        if not page_indices:
            return {"ok": False, "error": "No se especificaron páginas válidas para rotar."}
        for p_idx in page_indices:
            doc[p_idx].set_rotation((doc[p_idx].rotation + angle) % 360)
        doc.save(output_file)
        if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
            return {"ok": False, "error": "No se generó el archivo rotado de salida."}
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def handle_extract(data):
    doc = None
    new_doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "extracted.pdf"))
        pages_param = data.get("pages", "").strip()
        if not pages_param:
            return {"ok": False, "error": "No se especificaron páginas para extraer."}
        doc = fitz.open(input_file)
        new_doc = fitz.open()
        for part in pages_param.split(","):
            part = part.strip()
            if "-" in part:
                s, e = part.split("-")
                start = int(s) - 1
                end = doc.page_count - 1 if e.lower() == 'z' else int(e) - 1
                new_doc.insert_pdf(doc, from_page=start, to_page=end)
            else:
                idx = int(part) - 1
                new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
        if new_doc.page_count == 0:
            return {"ok": False, "error": "No se extrajeron páginas válidas."}
        new_doc.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass
        if new_doc:
            try:
                new_doc.close()
            except Exception:
                pass

def handle_delete_pages(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "deleted.pdf"))
        if not input_file:
            return {"ok": False, "error": "No se proporcionó archivo de entrada."}
        doc = fitz.open(input_file)
        to_delete = parse_pages_param(data.get("pages", ""), doc.page_count)
        if not to_delete:
            return {"ok": False, "error": "No se especificaron páginas válidas para eliminar."}
        if len(to_delete) >= doc.page_count:
            return {"ok": False, "error": "No se pueden eliminar todas las páginas del documento"}
        for idx in reversed(to_delete):
            doc.delete_page(idx)
        doc.save(output_file)
        if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
            return {"ok": False, "error": "No se generó el archivo de salida."}
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def handle_reorder_pages(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "reordered.pdf"))
        if not input_file:
            return {"ok": False, "error": "No se proporcionó archivo de entrada."}
        order = [int(x) - 1 for x in data.get("order", [])]
        if not order:
            return {"ok": False, "error": "No se especificó un orden de páginas."}
        doc = fitz.open(input_file)
        if len(order) != doc.page_count:
            return {"ok": False, "error": f"El orden debe incluir todas las páginas ({doc.page_count} páginas)."}
        doc.select(order)
        doc.save(output_file)
        if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
            return {"ok": False, "error": "No se generó el archivo de salida."}
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def handle_watermark(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "watermarked.pdf"))
        text = data.get("text", "CONFIDENCIAL")
        opacity = float(data.get("opacity", 0.3))
        angle = float(data.get("angle", 45))
        doc = fitz.open(input_file)
        for page in doc:
            rect = page.rect
            page.insert_text(
                fitz.Point(rect.width / 2, rect.height / 2),
                text,
                fontsize=60,
                color=(0.7, 0.7, 0.7),
                fill_opacity=opacity,
                rotate=int(angle)
            )
        doc.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def handle_watermark_image(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "watermarked_img.pdf"))
        img_path = os.path.abspath(data.get("image", ""))
        opacity = float(data.get("opacity", 0.3))
        if not os.path.exists(img_path):
            return {"ok": False, "error": f"Imagen de marca de agua no encontrada: {img_path}"}
        doc = fitz.open(input_file)
        for page in doc:
            page_rect = page.rect
            img_w = page_rect.width * 0.5
            img_h = page_rect.height * 0.5
            x0 = (page_rect.width - img_w) / 2
            y0 = (page_rect.height - img_h) / 2
            img_rect = fitz.Rect(x0, y0, x0 + img_w, y0 + img_h)
            page.insert_image(
                img_rect,
                filename=img_path,
                keep_proportion=True,
                overlay=True,
                alpha=int(opacity * 255)
            )
        doc.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass

def handle_crop(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "cropped.pdf"))
        rect_data = data.get("rect", [0, 0, 100, 100])
        doc = fitz.open(input_file)
        if doc.page_count > 0:
            for page in doc:
                wp = page.rect.width
                hp = page.rect.height
                # Clamp al tamaño real de cada página
                x0 = max(0, min(rect_data[0], wp))
                y0 = max(0, min(rect_data[1], hp))
                x1 = max(0, min(rect_data[2], wp))
                y1 = max(0, min(rect_data[3], hp))
                if x1 > x0 and y1 > y0:
                    page.set_cropbox(fitz.Rect(x0, y0, x1, y1))
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_add_page_numbers(data):
    doc = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "numbered.pdf"))
        pos = data.get("position", "bottom-center")
        start = int(data.get("start", 1))
        doc = fitz.open(input_file)
        for i, page in enumerate(doc):
            text = str(start + i)
            rect = page.rect
            if pos == "bottom-center": p = (rect.width/2, rect.height - 20)
            elif pos == "bottom-right": p = (rect.width - 40, rect.height - 20)
            else: p = (rect.width/2, 30)
            page.insert_text(p, text, fontsize=10, color=(0.5, 0.5, 0.5))
        doc.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
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
        import tempfile
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
        import hashlib
        file_hash = hashlib.md5(input_file.encode()).hexdigest()[:8]
        thumb_name = f"pdfthumb_{file_hash}.png"
        thumb_path = os.path.join(tempfile.gettempdir(), thumb_name)
        pix.save(thumb_path)

        return {"ok": True, "thumb_path": thumb_path}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try: doc.close()
            except Exception: pass


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

def handle_protect(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "protected.pdf"))
        pwd = data.get("password", "")
        with pikepdf.open(input_file) as pdf:
            pdf.save(output_file, encryption=pikepdf.Encryption(owner=pwd, user=pwd))
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_unlock(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "unlocked.pdf"))
        pwd = data.get("password", "")
        with pikepdf.open(input_file, password=pwd) as pdf:
            pdf.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_repair(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "repaired.pdf"))
        with pikepdf.open(input_file, allow_overwriting_input=False) as pdf:
            pdf.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_ocr(data):
    doc = None
    output_pdf = None
    try:
        if not pytesseract:
            return {"ok": False, "error": "Librería pytesseract no instalada"}
            
        # P17: Resolver ruta dinámica de Tesseract
        tesseract_exe = resolve_tesseract_path(data.get("tesseract_path"))
        if not tesseract_exe:
            return {"ok": False, "error": "No se encontró el motor Tesseract OCR. Instálalo o configura la ruta en Settings."}
        
        pytesseract.pytesseract.tesseract_cmd = tesseract_exe
            
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", ""))
        lang = data.get("lang", "spa")
        
        doc = fitz.open(input_file)
        output_pdf = fitz.open()
        
        temp_files = []
        try:
            for page in doc:
                pix = page.get_pixmap(dpi=300)
                img_path = output_file + f"_temp_{page.number}.png"
                temp_files.append(img_path)
                pix.save(img_path)
                pdf_bytes = pytesseract.image_to_pdf_or_hocr(img_path, lang=lang, extension='pdf')
                temp_pdf = fitz.open("pdf", pdf_bytes)
                output_pdf.insert_pdf(temp_pdf)
                sys.stderr.write(f"OCR_PROGRESS:{page.number + 1}\n")
                sys.stderr.flush()
        finally:
            for f in temp_files:
                if os.path.exists(f):
                    os.remove(f)
        
        output_pdf.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass
        if output_pdf:
            try:
                output_pdf.close()
            except Exception:
                pass

def handle_word_to_pdf(data):
    pythoncom.CoInitialize()
    word = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", ""))
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(input_file)
        doc.ExportAsFixedFormat(output_file, 17)
        doc.Close(False)
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}
    finally:
        if word:
            try:
                word.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

def handle_pdf_to_word(data):
    pythoncom.CoInitialize()
    word = None
    input_file = os.path.abspath(data.get("input", ""))
    output_file = os.path.abspath(data.get("output", ""))

    def _is_pdf_protected(path):
        try:
            doc = fitz.open(path)
            protected = doc.needs_pass
            doc.close()
            return protected
        except Exception:
            return False

    if _is_pdf_protected(input_file):
        return {
            "ok": False,
            "error": "El PDF está protegido con contraseña. Usa la herramienta 'Desbloquear PDF' primero."
        }

    def _validate_docx(path):
        """Verifica que el .docx resultante tenga contenido mínimo."""
        try:
            if not os.path.exists(path):
                return False, "El archivo de salida no fue creado."
            size = os.path.getsize(path)
            if size < 1024:  # menos de 1KB es sospechoso
                return False, f"El archivo resultante es demasiado pequeño ({size} bytes). Posible conversión vacía."
            return True, None
        except Exception as e:
            return False, str(e)

    def _classify_pdf(path, sample_pages=5):
        """
        Analiza el contenido de un PDF y retorna su perfil.
        Solo usa fitz/PyMuPDF — sin dependencias adicionales.
        """
        try:
            doc = fitz.open(path)
            page_count = doc.page_count
            pages_to_sample = min(sample_pages, page_count)
            
            text_chars = []
            image_counts = []
            drawing_counts = []
            has_forms = False
            column_layouts = 0
            
            for i in range(pages_to_sample):
                page = doc[i]
                
                # Dimensión 1: texto
                words = page.get_text("words")
                chars = sum(len(w[4]) for w in words) if words else 0
                text_chars.append(chars)
                
                # Dimensión 2: imágenes
                images = page.get_images()
                image_counts.append(len(images))
                
                # Dimensión 3: trazos vectoriales
                drawings = page.get_drawings()
                drawing_counts.append(len(drawings))
                
                # Dimensión 4: formularios/firmas digitales
                try:
                    widgets = list(page.widgets())
                    if widgets:
                        has_forms = True
                except Exception:
                    pass
                
                # Dimensión 5: detectar layout multi-columna
                # Si los bloques de texto tienen posiciones X muy dispersas
                blocks = page.get_text("blocks")
                if blocks and len(blocks) > 4:
                    x_positions = [b[0] for b in blocks if b[6] == 0]
                    if x_positions:
                        x_range = max(x_positions) - min(x_positions)
                        page_width = page.rect.width
                        if x_range > page_width * 0.4:
                            column_layouts += 1
            
            doc.close()
            
            avg_text = sum(text_chars) / len(text_chars) if text_chars else 0
            avg_images = sum(image_counts) / len(image_counts) if image_counts else 0
            avg_drawings = sum(drawing_counts) / len(drawing_counts) if drawing_counts else 0
            has_text = avg_text > 30
            has_images = avg_images > 0
            has_drawings = avg_drawings > 5
            is_multi_column = column_layouts > pages_to_sample * 0.4
            
            if not has_text and has_images:
                profile = "scanned"
                confidence = "high"
                recommendation = "PDF escaneado detectado. Se usará pdf2docx con OCR."
            elif has_forms or (has_drawings and not has_text):
                profile = "form_signature"
                confidence = "high"
                recommendation = "Formulario o firma digital detectada. Word COM dará mejor resultado."
            elif has_text and has_images and avg_images > 1:
                profile = "mixed"
                confidence = "medium"
                recommendation = "PDF mixto (texto + imágenes). Word COM intentará preservar el layout."
            elif is_multi_column and has_text:
                profile = "complex_layout"
                confidence = "medium"
                recommendation = "Layout complejo detectado. La conversión puede variar en fidelidad."
            elif has_text and not has_images:
                profile = "digital_clean"
                confidence = "high"
                recommendation = "PDF digital limpio. Conversión de alta fidelidad esperada."
            else:
                profile = "digital_rich"
                confidence = "medium"
                recommendation = "PDF digital con contenido mixto. Word COM es el motor recomendado."
            
            return {
                "profile": profile,
                "has_text": has_text,
                "has_images": has_images,
                "has_drawings": has_drawings,
                "has_forms": has_forms,
                "avg_text_density": round(avg_text, 1),
                "avg_image_count": round(avg_images, 1),
                "avg_drawing_count": round(avg_drawings, 1),
                "page_count": page_count,
                "confidence": confidence,
                "recommendation": recommendation
            }
        except Exception as e:
            return {
                "profile": "unknown",
                "has_text": False,
                "has_images": False,
                "has_drawings": False,
                "has_forms": False,
                "avg_text_density": 0,
                "avg_image_count": 0,
                "avg_drawing_count": 0,
                "page_count": 0,
                "confidence": "low",
                "recommendation": f"No se pudo analizar el PDF: {str(e)}"
            }

    pdf_info = _classify_pdf(input_file)
    profile = pdf_info["profile"]

    def _ok_result(output_path, warning=None, pdf_profile=None):
        valid, reason = _validate_docx(output_path)
        if not valid:
            return {"ok": False, "error": f"Conversión completada pero resultado inválido: {reason}"}
        result = {"ok": True, "output": output_path}
        if warning:
            result["warning"] = warning
        if pdf_profile:
            result["pdf_profile"] = pdf_profile
        return result

    if profile == "scanned":
        strategy_order = ["pdf2docx", "word_com"]
    elif profile in ("digital_clean", "digital_rich", "form_signature", "mixed"):
        strategy_order = ["word_com", "pdf2docx"]
    elif profile == "complex_layout":
        strategy_order = ["word_com", "pdf2docx"]
    else:
        strategy_order = ["word_com", "pdf2docx"]

    base_warning = None
    if pdf_info["confidence"] != "high" or profile in ("mixed", "complex_layout"):
        base_warning = pdf_info["recommendation"]

    errors = []
    try:
        for strategy in strategy_order:
            try:
                if strategy == "word_com":
                    word = win32com.client.DispatchEx("Word.Application")
                    word.Visible = False
                    word.DisplayAlerts = 0
                    doc = word.Documents.Open(
                        input_file, ConfirmConversions=False, ReadOnly=True)
                    doc.SaveAs2(output_file, 16)
                    doc.Close(False)
                    word.Quit()
                    word = None
                    return _ok_result(output_file, base_warning, profile)
                elif strategy == "pdf2docx":
                    pythoncom.CoInitialize()
                    try:
                        from pdf2docx import Converter
                    except ImportError:
                        errors.append("pdf2docx: Librería no instalada. Ejecuta: pip install pdf2docx")
                        continue
                    
                    cv = Converter(input_file)
                    cv.convert(output_file,
                        start=0, end=None,
                        multi_processing=False,
                        connected_border_tolerance=0,
                        line_overlap_threshold=0.9,
                        image_overlap_threshold=0.0,
                    )
                    cv.close()
                    warning = base_warning or "Conversión via pdf2docx. Layouts complejos pueden variar."
                    return _ok_result(output_file, warning, profile)
            except Exception as e:
                if word:
                    try: word.Quit()
                    except Exception: pass
                    word = None
                errors.append(f"{strategy}: {str(e)}")
                continue

        return {"ok": False, "error": " | ".join(errors)}
    finally:
        if word:
            try: word.Quit()
            except Exception: pass
        try: pythoncom.CoUninitialize()
        except Exception: pass

def handle_excel_to_pdf(data):
    pythoncom.CoInitialize()
    excel = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", ""))
        excel = win32com.client.DispatchEx("Excel.Application")
        excel.Visible = False
        wb = excel.Workbooks.Open(input_file)
        wb.ExportAsFixedFormat(0, output_file)
        wb.Close(False)
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}
    finally:
        if excel:
            try:
                excel.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

def handle_ppt_to_pdf(data):
    pythoncom.CoInitialize()
    ppt = None
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", ""))
        ppt = win32com.client.DispatchEx("PowerPoint.Application")
        pres = ppt.Presentations.Open(input_file, WithWindow=False)
        pres.ExportAsFixedFormat(output_file, 2)
        pres.Close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}
    finally:
        if ppt:
            try:
                ppt.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

def handle_get_page_info(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        if not os.path.exists(input_file):
            return {"ok": False, "error": f"Archivo no encontrado: {input_file}"}
        doc = fitz.open(input_file)
        page_count = doc.page_count
        pages = []
        for i in range(page_count):
            page = doc[i]
            pages.append({
                "number": i + 1,
                "width": round(page.rect.width, 2),
                "height": round(page.rect.height, 2)
            })
        doc.close()
        return {"ok": True, "pageCount": page_count, "pages": pages}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def main():
    while True:
        line = sys.stdin.readline()
        if not line: break
        start_idx = line.find('{')
        if start_idx == -1: continue
        end_idx = line.rfind('}')
        if end_idx == -1: continue
        line = line[start_idx:end_idx+1].strip()
        try:
            request = json.loads(line)
            cmd = request.get("cmd")
            data = request.get("data", {})
            request_id = request.get("id")
            
            if cmd == "ping": response = {"ok": True, "status": "ready"}
            elif cmd == "merge": response = handle_merge(data)
            elif cmd == "compress": response = handle_compress(data)
            elif cmd == "split": response = handle_split(data)
            elif cmd == "rotate": response = handle_rotate(data)
            elif cmd == "extract": response = handle_extract(data)
            elif cmd == "delete_pages": response = handle_delete_pages(data)
            elif cmd == "reorder_pages": response = handle_reorder_pages(data)
            elif cmd == "watermark": response = handle_watermark(data)
            elif cmd == "watermark_image": response = handle_watermark_image(data)
            elif cmd == "crop": response = handle_crop(data)
            elif cmd == "add_page_numbers": response = handle_add_page_numbers(data)
            elif cmd == "jpg_to_pdf": response = handle_jpg_to_pdf(data)
            elif cmd == "pdf_to_jpg": response = handle_pdf_to_jpg(data)
            elif cmd == "html_to_pdf": response = handle_html_to_pdf(data)
            elif cmd == "protect": response = handle_protect(data)
            elif cmd == "unlock": response = handle_unlock(data)
            elif cmd == "repair": response = handle_repair(data)
            elif cmd == "ocr": response = handle_ocr(data)
            elif cmd == "word_to_pdf": response = handle_word_to_pdf(data)
            elif cmd == "pdf_to_word": response = handle_pdf_to_word(data)
            elif cmd == "excel_to_pdf": response = handle_excel_to_pdf(data)
            elif cmd == "ppt_to_pdf": response = handle_ppt_to_pdf(data)
            elif cmd == "get_page_info": response = handle_get_page_info(data)
            else: response = {"ok": False, "error": f"Comando desconocido: {cmd}"}
            send_response(response, request_id)
        except Exception as e: send_response({"ok": False, "error": str(e)}, request.get("id") if 'request' in locals() else None)

if __name__ == "__main__":
    main()
