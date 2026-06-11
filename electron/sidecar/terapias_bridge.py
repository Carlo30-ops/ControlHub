import sys
import os
import json
import shutil
import datetime
import pythoncom
import win32com.client
import glob

# Redirigir cualquier output inesperado de librerías a stderr
# para que no contamine el canal JSON de stdout
_true_stdout = sys.stdout
sys.stdout = sys.stderr
os.environ['PYTHONWARNINGS'] = 'ignore'

# Wrapper para asegurar que solo JSON válido va a stdout
def send_response(data):
    _true_stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    _true_stdout.flush()

# Importar funciones de lógica local
from terapias_logic import (
    sanitize_filename,
    patient_from_user_input,
    check_path_length,
    build_folder_structure
)
import check_word_install

# Configuración de meses para la estructura de carpetas
MESES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
    5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
    9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
}

DEFAULT_SOURCE = r"C:\Users\factu\OneDrive\Documentos 1\TERAPIAS\DOCUMENTOS PARA ARMAR"

def handle_check_word():
    """Verifica si Word está disponible."""
    success, message = check_word_install.check_word_com()
    if success:
        return {"ok": True, "message": message}
    else:
        return {"ok": False, "error": message}

def handle_list_docs(data):
    """Lista archivos Word en la carpeta origen."""
    try:
        source_dir = data.get("source_dir", DEFAULT_SOURCE)
        if not os.path.exists(source_dir):
            return {"ok": True, "files": [], "warning": f"Carpeta origen no encontrada: {source_dir}"}
        
        files = []
        for ext in ["*.docx", "*.doc"]:
            files.extend([os.path.basename(f) for f in glob.glob(os.path.join(source_dir, ext))])
        
        return {"ok": True, "files": sorted(files)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def handle_prepare(data):
    """Paso 1: Mover archivo, crear estructura y abrir Word."""
    try:
        input_name = data.get("input_name", "").strip()
        filename = data.get("filename", "") # Si viene de la lista
        base_dest = os.path.abspath(data.get("base_dest", ""))
        source_dir = data.get("source_dir", DEFAULT_SOURCE)
        
        if not input_name:
            return {"ok": False, "error": "El nombre de entrada está vacío"}
        
        source_path = ""
        if filename:
            source_path = os.path.join(source_dir, filename)
        else:
            # Si no hay filename, buscar el primero disponible
            docs = []
            for ext in ["*.docx", "*.doc"]:
                docs.extend(glob.glob(os.path.join(source_dir, ext)))
            if not docs:
                return {"ok": False, "error": f"No se encontraron archivos Word en {source_dir}"}
            source_path = docs[0]

        if not os.path.exists(source_path):
            return {"ok": False, "error": f"Archivo no encontrado: {source_path}"}

        # 1. Extraer paciente y limpiar nombre
        patient = patient_from_user_input(input_name)
        clean_name = sanitize_filename(input_name)
        
        # 2. Construir rutas (AÑO/MES/DÍA)
        hoy = datetime.date.today()
        _, _, ruta_dia, _ = build_folder_structure(base_dest, hoy.year, hoy.month, hoy.day, MESES)
        patient_folder = os.path.join(ruta_dia, patient)
        os.makedirs(patient_folder, exist_ok=True)

        # 3. Mover el archivo a la carpeta del paciente
        ext = os.path.splitext(source_path)[1].lower()
        dest_doc_path = os.path.join(patient_folder, clean_name + ext)
        
        # Evitar colisión
        n = 1
        while os.path.exists(dest_doc_path):
            dest_doc_path = os.path.join(patient_folder, f"{clean_name}_{n}{ext}")
            n += 1

        shutil.move(source_path, dest_doc_path)

        # 4. Abrir para edición
        os.startfile(dest_doc_path)

        return {
            "ok": True,
            "patient": patient,
            "doc_path": dest_doc_path,
            "folder": patient_folder
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def handle_finalize_backup(data):
    """Paso 2: Mover archivo original a backup (la conversión a PDF se hace vía main -> pdf_bridge)."""
    try:
        doc_path = os.path.abspath(data.get("doc_path", ""))
        backup_dir = os.path.abspath(data.get("backup", ""))

        if not os.path.exists(doc_path):
            return {"ok": False, "error": f"Archivo Word no encontrado para backup: {doc_path}"}

        # Mover a backup
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{timestamp}_{os.path.basename(doc_path)}"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.move(doc_path, backup_path)

        return {
            "ok": True,
            "backup_path": backup_path
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        
        try:
            request = json.loads(line)
            cmd = request.get("cmd")
            data = request.get("data", {})

            if cmd == "ping":
                response = {"ok": True, "status": "ready"}
            elif cmd == "check_word":
                response = handle_check_word()
            elif cmd == "list_docs":
                response = handle_list_docs(data)
            elif cmd == "prepare":
                response = handle_prepare(data)
            elif cmd == "finalize_backup":
                response = handle_finalize_backup(data)
            else:
                response = {"ok": False, "error": f"Comando desconocido: {cmd}"}

            send_response(response)
        except Exception as e:
            send_response({"ok": False, "error": f"Error inesperado: {str(e)}"})

if __name__ == "__main__":
    main()
