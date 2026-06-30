import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import fitz  # pymupdf
except ImportError:
    pass

from pdf_utils import parse_pages_param


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
