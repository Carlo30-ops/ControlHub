import os
import sys
import hashlib
from PIL import Image
import io

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import fitz  # pymupdf
except ImportError:
    print("PyMuPDF no instalado")
    sys.exit(1)

pdf_path = r"C:\Users\Carlo\OneDrive\Documentos\FACTURACION\2026\JUNIO\20 JUNIO\POSITIVA\COTU84522\EPI_900175697_COTU84522.pdf"

if not os.path.exists(pdf_path):
    print(f"PDF no encontrado: {pdf_path}")
    sys.exit(1)

doc = fitz.open(pdf_path)
print(f"PDF cargado: {doc.page_count} páginas\n")

# Páginas con firmas según el usuario
pages_to_analyze = [1, 5, 6, 7]  # páginas 2, 6, 7, 8 (0-indexed)

for page_num in pages_to_analyze:
    if page_num >= doc.page_count:
        continue
    
    page = doc[page_num]
    page_width = page.rect.width
    page_height = page.rect.height
    page_area = page_width * page_height
    
    print(f"=== PÁGINA {page_num + 1} ===")
    print(f"Dimensiones página: {page_width:.1f} x {page_height:.1f} (área: {page_area:.1f})")
    
    # Obtener todas las imágenes de la página
    image_list = page.get_images(full=True)
    print(f"Imágenes encontradas: {len(image_list)}")
    
    for img_idx, img in enumerate(image_list):
        xref = img[0]
        base_image = doc.extract_image(xref)
        
        if base_image is None:
            continue
        
        image_data = base_image["image"]
        img_width = base_image["width"]
        img_height = base_image["height"]
        img_area = img_width * img_height
        ext = base_image["ext"]
        
        # Obtener posición de la imagen en la página
        image_rects = page.get_image_rects(xref)
        if not image_rects:
            continue
        
        rect = image_rects[0]
        rect_width = rect.x1 - rect.x0
        rect_height = rect.y1 - rect.y0
        rect_area = rect_width * rect_height
        
        # Calcular tamaño relativo a la página
        width_ratio = (rect_width / page_width) * 100
        height_ratio = (rect_height / page_height) * 100
        area_ratio = (rect_area / page_area) * 100
        
        # Calcular proporción de aspecto
        aspect_ratio = img_width / img_height if img_height > 0 else 0
        
        # Calcular densidad de píxeles no blancos
        try:
            pil_image = Image.open(io.BytesIO(image_data))
            
            # Convertir a RGB si es necesario
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            # Contar píxeles no blancos
            pixels = pil_image.getdata()
            non_white_count = sum(1 for p in pixels if p != (255, 255, 255))
            total_pixels = len(pixels)
            density = (non_white_count / total_pixels) * 100 if total_pixels > 0 else 0
        except Exception as e:
            density = 0
            print(f"Error calculando densidad: {e}")
        
        # Verificar posición (tercio inferior)
        y_center = (rect.y0 + rect.y1) / 2
        in_bottom_third = y_center > (page_height * (2/3))
        
        print(f"\n  Imagen {img_idx + 1}:")
        print(f"    Extensión: {ext}")
        print(f"    Dimensiones: {img_width} x {img_height}")
        print(f"    Posición en página: ({rect.x0:.1f}, {rect.y0:.1f}) a ({rect.x1:.1f}, {rect.y1:.1f})")
        print(f"    Tamaño en página: {rect_width:.1f} x {rect_height:.1f}")
        print(f"    Ratio ancho/página: {width_ratio:.2f}%")
        print(f"    Ratio altura/página: {height_ratio:.2f}%")
        print(f"    Ratio área/página: {area_ratio:.2f}%")
        print(f"    Proporción aspecto (ancho/alto): {aspect_ratio:.2f}")
        print(f"    Densidad píxeles no blancos: {density:.2f}%")
        print(f"    En tercio inferior: {in_bottom_third}")
        
        # Guardar imagen para inspección visual
        output_path = f"C:\\DEV\\TODO EN UNO\\ControlHub\\signature_page{page_num + 1}_img{img_idx + 1}.{ext}"
        try:
            with open(output_path, "wb") as f:
                f.write(image_data)
            print(f"    Guardada en: {output_path}")
        except Exception as e:
            print(f"    Error guardando imagen: {e}")

doc.close()
print("\n=== ANÁLISIS COMPLETADO ===")
