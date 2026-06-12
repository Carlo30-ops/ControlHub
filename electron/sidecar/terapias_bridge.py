import sys
import os
import json
import shutil
import datetime
import pythoncom
import win32com.client
import glob
import logging
from logging.handlers import RotatingFileHandler

# Redirigir cualquier output inesperado de librerías a stderr
# para que no contamine el canal JSON de stdout
_true_stdout = sys.stdout
sys.stdout = sys.stderr
os.environ['PYTHONWARNINGS'] = 'ignore'

# Wrapper para asegurar que solo JSON válido va a stdout
def send_response(data):
    _true_stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    _true_stdout.flush()

# Configuración de Logging (para historial)
LOG_FILE = os.path.join(os.path.expanduser("~"), "Documents", "TERAPIAS", "organizar_log.txt")
try:
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
except:
    pass

handler = RotatingFileHandler(LOG_FILE, maxBytes=1024 * 1024, backupCount=1, encoding="utf-8")
handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
logger = logging.getLogger("terapias")
logger.setLevel(logging.INFO)
logger.addHandler(handler)

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
    """Lista archivos Word en la carpeta origen ordenados por mtime desc."""
    try:
        source_dir = data.get("source_dir", DEFAULT_SOURCE)
        if not os.path.exists(source_dir):
            return {"ok": True, "files": [], "warning": f"Carpeta origen no encontrada: {source_dir}"}
        
        files = []
        for ext in ["*.docx", "*.doc"]:
            for f in glob.glob(os.path.join(source_dir, ext)):
                stat = os.stat(f)
                files.append({
                    "name": os.path.basename(f),
                    "modified": stat.st_mtime,
                    "size": stat.st_size
                })
        
        # Ordenar por fecha de modificación descendente (más reciente primero)
        files.sort(key=lambda x: x["modified"], reverse=True)
        return {"ok": True, "files": files}
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
            docs.sort(key=lambda x: os.path.getmtime(x), reverse=True)
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

        if not check_path_length(dest_doc_path):
            return {"ok": False, "error": "La ruta de destino es demasiado larga para Windows."}

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

def handle_finalize(data):
    """Paso 2: Convertir a PDF y mover a backup (One-Click)."""
    try:
        doc_path = os.path.abspath(data.get("doc_path", ""))
        backup_dir = os.path.abspath(data.get("backup", ""))
        patient = data.get("patient", "Desconocido")

        if not os.path.exists(doc_path):
            return {"ok": False, "error": f"Archivo Word no encontrado: {doc_path}"}

        pdf_path = os.path.splitext(doc_path)[0] + ".pdf"

        # 1. Conversión Word -> PDF vía COM
        pythoncom.CoInitialize()
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0
            doc = word.Documents.Open(doc_path, ReadOnly=False)
            doc.SaveAs(pdf_path, FileFormat=17) # 17 = wdFormatPDF
            doc.Close(SaveChanges=False)
            word.Quit()
        except Exception as e:
            return {"ok": False, "error": f"Error en conversión PDF (¿Word abierto?): {str(e)}"}
        finally:
            pythoncom.CoUninitialize()

        if not os.path.exists(pdf_path):
            return {"ok": False, "error": "El PDF no se generó correctamente."}

        # 2. Mover a backup
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{timestamp}_{os.path.basename(doc_path)}"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.move(doc_path, backup_path)

        # 3. Registrar en log para historial
        log_entry = {
            "date": datetime.datetime.now().isoformat(),
            "patient": patient,
            "filename": os.path.basename(pdf_path),
            "pdfPath": pdf_path,
            "backupPath": backup_path
        }
        logger.info(f"HISTORY|{json.dumps(log_entry)}")

        return {
            "ok": True,
            "pdf_path": pdf_path,
            "backup_path": backup_path
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def handle_get_history():
    """Lee el historial desde el archivo de log."""
    try:
        if not os.path.exists(LOG_FILE):
            return {"ok": True, "history": []}
        
        history = []
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            for line in reversed(lines):
                if "HISTORY|" in line:
                    try:
                        data_str = line.split("HISTORY|")[1].strip()
                        history.append(json.loads(data_str))
                        if len(history) >= 50:
                            break
                    except:
                        continue
        return {"ok": True, "history": history}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def handle_search_patient(data):
    """Busca carpetas de pacientes en la raíz de destino."""
    try:
        query = data.get("query", "").lower().strip()
        dest_root = data.get("dest_root", "")
        if not query or not os.path.exists(dest_root):
            return {"ok": True, "results": []}

        results = []
        # Recorrer AÑO/MES/DÍA/PACIENTE
        for year in os.listdir(dest_root):
            y_path = os.path.join(dest_root, year)
            if not os.path.isdir(y_path): continue
            for month in os.listdir(y_path):
                m_path = os.path.join(y_path, month)
                if not os.path.isdir(m_path): continue
                for day in os.listdir(m_path):
                    d_path = os.path.join(m_path, day)
                    if not os.path.isdir(d_path): continue
                    for patient in os.listdir(d_path):
                        if query in patient.lower():
                            p_path = os.path.join(d_path, patient)
                            if os.path.isdir(p_path):
                                stat = os.stat(p_path)
                                results.append({
                                    "name": patient,
                                    "path": p_path,
                                    "lastModified": stat.st_mtime
                                })
                                if len(results) >= 10:
                                    return {"ok": True, "results": results}
        return {"ok": True, "results": results}
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
            elif cmd == "finalize":
                response = handle_finalize(data)
            elif cmd == "get_history":
                response = handle_get_history()
            elif cmd == "search_patient":
                response = handle_search_patient(data)
            else:
                response = {"ok": False, "error": f"Comando desconocido: {cmd}"}

            send_response(response)
        except Exception as e:
            send_response({"ok": False, "error": f"Error inesperado: {str(e)}"})

if __name__ == "__main__":
    main()
