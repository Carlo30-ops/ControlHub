import sys
import os
import json
import subprocess
import pythoncom
import win32com.client
from pdf2docx import Converter
import pikepdf
import fitz  # pymupdf
try:
    import pytesseract
    from PIL import Image
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
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
def send_response(data):
    _true_stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    _true_stdout.flush()

# --- Helpers ---

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
        if level == "fast":
            with pikepdf.open(input_file) as pdf:
                pdf.save(output_file, linearize=True)
            return {"ok": True, "output": output_file}
        settings = f"/{level}" if not level.startswith("/") else level
        cmd = ["gswin64c", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", f"-dPDFSETTINGS={settings}", 
               "-dNOPAUSE", "-dQUIET", "-dBATCH", f"-sOutputFile={output_file}", input_file]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0: return {"ok": False, "error": result.stderr}
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_split(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_dir = os.path.abspath(data.get("output_dir", "."))
        ranges = data.get("ranges", "")
        if not os.path.exists(output_dir): os.makedirs(output_dir)
        doc = fitz.open(input_file)
        range_list = [r.strip() for r in ranges.split(",") if r.strip()]
        outputs = []
        for idx, r in enumerate(range_list):
            out_part = os.path.join(output_dir, f"part_{idx+1}_{r.replace('-', '_')}.pdf")
            if "-" in r:
                s_s, e_s = r.split("-")
                start = int(s_s) - 1
                end = doc.page_count - 1 if e_s.lower() == 'z' else int(e_s) - 1
            else: start = end = int(r) - 1
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=start, to_page=end)
            new_doc.save(out_part)
            new_doc.close()
            outputs.append(out_part)
        doc.close()
        return {"ok": True, "outputs": outputs}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_rotate(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "rotated.pdf"))
        angle = int(data.get("angle", 90))
        doc = fitz.open(input_file)
        page_indices = parse_pages_param(data.get("pages", ""), doc.page_count)
        for p_idx in page_indices:
            doc[p_idx].set_rotation((doc[p_idx].rotation + angle) % 360)
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_extract(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "extracted.pdf"))
        doc = fitz.open(input_file)
        new_doc = fitz.open()
        for part in data.get("pages", "").split(","):
            part = part.strip()
            if "-" in part:
                s, e = part.split("-")
                start = int(s) - 1
                end = doc.page_count - 1 if e.lower() == 'z' else int(e) - 1
                new_doc.insert_pdf(doc, from_page=start, to_page=end)
            else:
                idx = int(part) - 1
                new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
        new_doc.save(output_file)
        new_doc.close()
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_delete_pages(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "deleted.pdf"))
        doc = fitz.open(input_file)
        to_delete = parse_pages_param(data.get("pages", ""), doc.page_count)
        if len(to_delete) >= doc.page_count:
            return {"ok": False, "error": "No se pueden eliminar todas las páginas del documento"}
        for idx in reversed(to_delete):
            doc.delete_page(idx)
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_reorder_pages(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "reordered.pdf"))
        order = [int(x) - 1 for x in data.get("order", [])]
        doc = fitz.open(input_file)
        doc.select(order)
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_watermark(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "watermarked.pdf"))
        text = data.get("text", "CONFIDENCIAL")
        opacity = float(data.get("opacity", 0.3))
        angle = int(data.get("angle", 45))
        # fitz insert_text solo permite múltiplos de 90
        safe_angle = (angle // 90) * 90
        doc = fitz.open(input_file)
        for page in doc:
            rect = page.rect
            page.insert_text((rect.width/4, rect.height/2), text, fontsize=60, rotate=safe_angle, color=(0.7, 0.7, 0.7), fill_opacity=opacity)
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_watermark_image(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "watermarked_img.pdf"))
        img_path = os.path.abspath(data.get("image", ""))
        # insert_image no soporta opacity directamente en versiones comunes de fitz
        doc = fitz.open(input_file)
        for page in doc:
            page.insert_image(page.rect, filename=img_path, keep_proportion=True, overlay=True)
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_crop(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "cropped.pdf"))
        rect_data = data.get("rect", [0, 0, 100, 100])
        doc = fitz.open(input_file)
        crop_rect = fitz.Rect(rect_data)
        for page in doc:
            page.set_cropbox(crop_rect)
        doc.save(output_file)
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_add_page_numbers(data):
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
        doc.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_jpg_to_pdf(data):
    try:
        images = [os.path.abspath(f) for f in data.get("images", [])]
        output = os.path.abspath(data.get("output", "images.pdf"))
        doc = fitz.open()
        for img in images:
            img_doc = fitz.open(img)
            pdf_bytes = img_doc.convert_to_pdf()
            img_doc.close()
            with fitz.open("pdf", pdf_bytes) as pdf_img:
                doc.insert_pdf(pdf_img)
        doc.save(output)
        doc.close()
        return {"ok": True, "output": output}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_pdf_to_jpg(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_dir = os.path.abspath(data.get("output_dir", "."))
        dpi = int(data.get("dpi", 150))
        if not os.path.exists(output_dir): os.makedirs(output_dir)
        doc = fitz.open(input_file)
        outputs = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=dpi)
            out_path = os.path.join(output_dir, f"page_{i+1}.jpg")
            pix.save(out_path)
            outputs.append(out_path)
        doc.close()
        return {"ok": True, "outputs": outputs}
    except Exception as e: return {"ok": False, "error": str(e)}

def handle_html_to_pdf(data):
    try:
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", "html.pdf"))
        with open(input_file, "r", encoding="utf-8") as f: html_content = f.read()
        doc = fitz.open(stream=html_content.encode("utf-8"), filetype="html")
        pdf_bytes = doc.convert_to_pdf()
        doc.close()
        with fitz.open("pdf", pdf_bytes) as pdf:
            pdf.save(output_file)
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

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
    try:
        if not pytesseract:
            return {"ok": False, "error": "Librería pytesseract no instalada"}
            
        input_file = os.path.abspath(data.get("input", ""))
        output_file = os.path.abspath(data.get("output", ""))
        lang = data.get("lang", "spa")
        
        doc = fitz.open(input_file)
        output_pdf = fitz.open()
        
        for page in doc:
            pix = page.get_pixmap(dpi=300)
            img_path = output_file + f"_temp_{page.number}.png"
            pix.save(img_path)
            pdf_bytes = pytesseract.image_to_pdf_or_hocr(img_path, lang=lang, extension='pdf')
            temp_pdf = fitz.open("pdf", pdf_bytes)
            output_pdf.insert_pdf(temp_pdf)
            os.remove(img_path)
        
        output_pdf.save(output_file)
        doc.close()
        output_pdf.close()
        return {"ok": True, "output": output_file}
    except Exception as e: return {"ok": False, "error": str(e)}

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
        if word: word.Quit()
        pythoncom.CoUninitialize()

def handle_pdf_to_word(data):
    input_file = os.path.abspath(data.get("input", ""))
    output_file = os.path.abspath(data.get("output", ""))
    try:
        cv = Converter(input_file)
        cv.convert(output_file, start=0, end=None)
        cv.close()
        return {"ok": True, "output": output_file}
    except Exception as e:
        pythoncom.CoInitialize()
        word = None
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            doc = word.Documents.Open(input_file)
            doc.SaveAs2(output_file, 16)
            doc.Close()
            return {"ok": True, "output": output_file}
        except Exception as e2: return {"ok": False, "error": str(e2)}
        finally:
            if word: word.Quit()
            pythoncom.CoUninitialize()

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
        if excel: excel.Quit()
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
        if ppt: ppt.Quit()
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
            send_response(response)
        except Exception as e: send_response({"ok": False, "error": str(e)})

if __name__ == "__main__":
    main()
