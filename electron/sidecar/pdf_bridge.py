import sys
import os
import traceback

# Agregar directorio engines al path para importar motores
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'engines'))

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

    # Importar motores de PDF
    try:
        from engines.compress import handle_compress
        from engines.merge import handle_merge
        from engines.split import handle_split
        from engines.p2w import handle_pdf_to_word
        from engines.ocr import handle_ocr
        from engines.office_to_pdf import handle_word_to_pdf, handle_excel_to_pdf, handle_ppt_to_pdf
        from engines.simple_ops import handle_rotate, handle_extract, handle_delete_pages, handle_reorder_pages, handle_crop, handle_add_page_numbers
        from engines.image_ops import handle_jpg_to_pdf, handle_pdf_to_jpg, handle_pdf_thumbnail, handle_page_thumbnails, handle_html_to_pdf
        from engines.security import handle_protect, handle_unlock, handle_repair
        from engines.watermark import handle_watermark, handle_watermark_image
    except ImportError as e:
        # Fallback durante migración
        print(f"Error importando motores: {e}", file=sys.stderr)
        handle_compress = None
        handle_merge = None
        handle_split = None
        handle_pdf_to_word = None
        handle_ocr = None
        handle_word_to_pdf = None
        handle_excel_to_pdf = None
        handle_ppt_to_pdf = None
        handle_rotate = None
        handle_extract = None
        handle_delete_pages = None
        handle_reorder_pages = None
        handle_crop = None
        handle_add_page_numbers = None
        handle_jpg_to_pdf = None
        handle_pdf_to_jpg = None
        handle_pdf_thumbnail = None
        handle_page_thumbnails = None
        handle_html_to_pdf = None
        handle_protect = None
        handle_unlock = None
        handle_repair = None
        handle_watermark = None
        handle_watermark_image = None

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

    # --- Helpers ---
    # ... (rest of the file content)
except Exception as e:
    sys.stderr.write(f"ERROR CRITICO EN PDF BRIDGE: {traceback.format_exc()}\n")
    sys.stderr.flush()
    sys.exit(1)

# --- Handlers ---

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
            elif cmd == "merge": 
                if handle_merge:
                    response = handle_merge(data)
                else:
                    response = {"ok": False, "error": "Motor merge no disponible"}
            elif cmd == "compress": 
                if handle_compress:
                    response = handle_compress(data)
                else:
                    response = {"ok": False, "error": "Motor compress no disponible"}
            elif cmd == "split": 
                if handle_split:
                    response = handle_split(data)
                else:
                    response = {"ok": False, "error": "Motor split no disponible"}
            elif cmd == "rotate": 
                if handle_rotate:
                    response = handle_rotate(data)
                else:
                    response = {"ok": False, "error": "Motor rotate no disponible"}
            elif cmd == "extract": 
                if handle_extract:
                    response = handle_extract(data)
                else:
                    response = {"ok": False, "error": "Motor extract no disponible"}
            elif cmd == "delete_pages": 
                if handle_delete_pages:
                    response = handle_delete_pages(data)
                else:
                    response = {"ok": False, "error": "Motor delete_pages no disponible"}
            elif cmd == "reorder_pages": 
                if handle_reorder_pages:
                    response = handle_reorder_pages(data)
                else:
                    response = {"ok": False, "error": "Motor reorder_pages no disponible"}
            elif cmd == "watermark": 
                if handle_watermark:
                    response = handle_watermark(data)
                else:
                    response = {"ok": False, "error": "Motor watermark no disponible"}
            elif cmd == "watermark_image": 
                if handle_watermark_image:
                    response = handle_watermark_image(data)
                else:
                    response = {"ok": False, "error": "Motor watermark_image no disponible"}
            elif cmd == "crop": 
                if handle_crop:
                    response = handle_crop(data)
                else:
                    response = {"ok": False, "error": "Motor crop no disponible"}
            elif cmd == "add_page_numbers": 
                if handle_add_page_numbers:
                    response = handle_add_page_numbers(data)
                else:
                    response = {"ok": False, "error": "Motor add_page_numbers no disponible"}
            elif cmd == "jpg_to_pdf": 
                if handle_jpg_to_pdf:
                    response = handle_jpg_to_pdf(data)
                else:
                    response = {"ok": False, "error": "Motor jpg_to_pdf no disponible"}
            elif cmd == "pdf_to_jpg": 
                if handle_pdf_to_jpg:
                    response = handle_pdf_to_jpg(data)
                else:
                    response = {"ok": False, "error": "Motor pdf_to_jpg no disponible"}
            elif cmd == "html_to_pdf": 
                if handle_html_to_pdf:
                    response = handle_html_to_pdf(data)
                else:
                    response = {"ok": False, "error": "Motor html_to_pdf no disponible"}
            elif cmd == "protect": 
                if handle_protect:
                    response = handle_protect(data)
                else:
                    response = {"ok": False, "error": "Motor protect no disponible"}
            elif cmd == "unlock": 
                if handle_unlock:
                    response = handle_unlock(data)
                else:
                    response = {"ok": False, "error": "Motor unlock no disponible"}
            elif cmd == "repair": 
                if handle_repair:
                    response = handle_repair(data)
                else:
                    response = {"ok": False, "error": "Motor repair no disponible"}
            elif cmd == "ocr": 
                if handle_ocr:
                    response = handle_ocr(data)
                else:
                    response = {"ok": False, "error": "Motor ocr no disponible"}
            elif cmd == "word_to_pdf": 
                if handle_word_to_pdf:
                    response = handle_word_to_pdf(data)
                else:
                    response = {"ok": False, "error": "Motor word_to_pdf no disponible"}
            elif cmd == "pdf_to_word": 
                if handle_pdf_to_word:
                    response = handle_pdf_to_word(data)
                else:
                    response = {"ok": False, "error": "Motor pdf_to_word no disponible"}
            elif cmd == "excel_to_pdf": 
                if handle_excel_to_pdf:
                    response = handle_excel_to_pdf(data)
                else:
                    response = {"ok": False, "error": "Motor excel_to_pdf no disponible"}
            elif cmd == "ppt_to_pdf": 
                if handle_ppt_to_pdf:
                    response = handle_ppt_to_pdf(data)
                else:
                    response = {"ok": False, "error": "Motor ppt_to_pdf no disponible"}
            elif cmd == "pdf_thumbnail": 
                if handle_pdf_thumbnail:
                    response = handle_pdf_thumbnail(data)
                else:
                    response = {"ok": False, "error": "Motor pdf_thumbnail no disponible"}
            elif cmd == "page_thumbnails": 
                if handle_page_thumbnails:
                    response = handle_page_thumbnails(data)
                else:
                    response = {"ok": False, "error": "Motor page_thumbnails no disponible"}
            elif cmd == "get_page_info": response = handle_get_page_info(data)
            else:
                response = {"ok": False, "error": f"Comando desconocido: {cmd}"}
            send_response(response, request_id)
        except Exception as e: send_response({"ok": False, "error": str(e)}, request.get("id") if 'request' in locals() else None)

if __name__ == "__main__":
    main()
