import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import fitz  # pymupdf
except ImportError:
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
