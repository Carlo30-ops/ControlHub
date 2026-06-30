import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import fitz  # pymupdf
    import pytesseract
except ImportError:
    pytesseract = None

from pdf_utils import resolve_tesseract_path


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
