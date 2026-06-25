import sys
import os
import traceback

try:
    import json
    import shutil
    import datetime
    import pythoncom
    import win32com.client
    import glob
    import logging
    import winreg
    from logging.handlers import RotatingFileHandler

    # Redirigir cualquier output inesperado de librerías a stderr
    # para que no contamine el canal JSON de stdout
    _true_stdout = sys.stdout
    sys.stdout = sys.stderr
    os.environ['PYTHONWARNINGS'] = 'ignore'

    # Wrapper para asegurar que solo JSON válido va a stdout
    def send_response(data, request_id=None):
        if request_id is not None:
            data["id"] = request_id
        _true_stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
        _true_stdout.flush()

    # ... (rest of the file content)
except Exception as e:
    sys.stderr.write(f"ERROR CRITICO EN TERAPIAS BRIDGE: {traceback.format_exc()}\n")
    sys.stderr.flush()
    sys.exit(1)

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

# Importar funciones de lógica local con importación perezosa (lazy)
import sys, os
sys.path.append(os.path.dirname(__file__))
try:
    from terapias_logic import (
        sanitize_filename,
        patient_from_user_input,
        check_path_length,
        build_folder_structure,
    )
except ImportError as e:
    sanitize_filename = patient_from_user_input = check_path_length = build_folder_structure = None
    sys.stderr.write(f"ERROR importing terapias_logic: {e}\n")
import check_word_install

# Configuración de meses para la estructura de carpetas
MESES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
    5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
    9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
}

def compute_default_source(custom_candidates=None):
    home = os.path.expanduser('~')
    candidates = custom_candidates if custom_candidates else [
        os.path.join(home, 'OneDrive', 'Documentos 1', 'TERAPIAS', 'DOCUMENTOS PARA ARMAR'),
        os.path.join(home, 'OneDrive', 'Documentos', 'TERAPIAS', 'DOCUMENTOS PARA ARMAR'),
        os.path.join(home, 'OneDrive', 'Documentos 1', 'TERAPIAS'),
        os.path.join(home, 'OneDrive', 'Documentos', 'TERAPIAS'),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return candidates[0]

DEFAULT_SOURCE = compute_default_source()

# Referencia global para mantener Word "caliente"
_word_app = None

def find_word_executable(custom_path=None):
    """
    Busca dinámicamente el ejecutable de Word en el sistema.
    Orden: Path configurado manualmente -> Registry -> Rutas comunes -> PATH
    """
    # 1. Usar path configurado manualmente si existe y es válido
    if custom_path and os.path.exists(custom_path):
        return custom_path
    
    # 2. Registro de Windows (App Paths) - fuente más confiable
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WINWORD.EXE") as key:
            path, _ = winreg.QueryValueEx(key, "")
            if os.path.exists(path):
                return path
    except Exception:
        pass

    # 2. Rutas conocidas comunes (fallback)
    common_paths = [
        r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office\root\Office15\WINWORD.EXE",
        r"C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office 16\ClientX64\WINWORD.EXE",
        r"C:\Program Files\Microsoft Office 15\ClientX64\WINWORD.EXE",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path

    # 3. Variable de entorno PATH (shutil.which)
    try:
        path = shutil.which("WINWORD.EXE")
        if path:
            return path
    except Exception:
        pass

    return None

def get_word_app():
    """Obtiene o crea una instancia persistente de Word. Retorna (app, error_msg)"""
    global _word_app
    pythoncom.CoInitialize()
    try:
        if _word_app:
            try:
                # Verificar si la instancia sigue viva
                _word_app.Visible = False
                return _word_app, None
            except Exception:
                _word_app = None

        try:
            # Dispatch busca una instancia existente o crea una nueva
            _word_app = win32com.client.Dispatch("Word.Application")
            _word_app.Visible = False
            _word_app.DisplayAlerts = 0
            return _word_app, None
        except Exception as first_error:
            try:
                # Fallback a DispatchEx para crear una instancia COM limpia
                _word_app = win32com.client.DispatchEx("Word.Application")
                _word_app.Visible = False
                _word_app.DisplayAlerts = 0
                return _word_app, None
            except Exception as second_error:
                error_msg = str(second_error)
                logger.error(f"No se pudo iniciar Word: {error_msg}")
                return None, error_msg
    finally:
        if _word_app is None:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass


def handle_check_word(data):
    """Verifica si Word está disponible."""
    custom_word_path = data.get("word_executable_path") if data else None
    
    word, error = get_word_app()
    if word:
        return {
            "ok": True,
            "word_installed": True,
            "message": "Microsoft Word está listo y persistente"
        }

    diagnostics = []
    try:
        reg_ok, reg_msg = check_word_install.check_word_in_registry()
        diagnostics.append(reg_msg)
    except Exception as diag_err:
        diagnostics.append(f"Error al verificar registro: {diag_err}")

    try:
        exe_ok, exe_msg = check_word_install.check_word_executable()
        diagnostics.append(exe_msg)
    except Exception as diag_err:
        diagnostics.append(f"Error al verificar ejecutable: {diag_err}")

    try:
        com_ok, com_msg = check_word_install.check_word_com()
        diagnostics.append(com_msg)
    except Exception as diag_err:
        diagnostics.append(f"Error al verificar COM: {diag_err}")

    word_path = find_word_executable(custom_word_path)
    detail = f"Ejecutable detectado en: {word_path}" if word_path else "No se detectó el ejecutable en rutas comunes ni PATH."
    return {
        "ok": False,
        "word_installed": False,
        "message": "Microsoft Word no está disponible. Revisa el detalle de diagnóstico.",
        "error": f"No se pudo conectar con Microsoft Word (COM): {error}. {detail} Detalles: {' | '.join(diagnostics)}"
    }

def handle_list_docs(data):
    """Lista archivos Word en la carpeta origen ordenados por mtime desc."""
    try:
        source_dir = data.get("source_dir", DEFAULT_SOURCE)
        print(f"[list_docs] source_dir recibido: {source_dir}", file=sys.stderr)
        print(f"[list_docs] existe: {os.path.exists(source_dir)}", file=sys.stderr)
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
        source_dir = os.path.abspath(data.get("source_dir", DEFAULT_SOURCE))
        
        if not input_name:
            return {"ok": False, "error": "El nombre de entrada está vacío"}
        
        source_path = ""
        if filename:
            # Requisito: Forzar basename para evitar traversal y aplicar sanitización al archivo
            clean_filename = sanitize_filename(os.path.basename(filename))
            source_path = os.path.join(source_dir, clean_filename)
            
            # Validar que source_path esté dentro de source_dir
            source_dir_abs = os.path.realpath(source_dir)
            source_path_abs = os.path.realpath(source_path)
            if os.path.commonpath([source_dir_abs, source_path_abs]) != source_dir_abs:
                return {"ok": False, "error": "Acceso no autorizado: la ruta de origen está fuera del directorio origen permitido."}
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
        # Requisito: Sanitizar el nombre del paciente para evitar traversal en la creación de carpetas
        patient = sanitize_filename(patient)
        clean_name = sanitize_filename(input_name)
        
        # 2. Construir rutas (AÑO/MES/DÍA)
        hoy = datetime.date.today()
        _, _, ruta_dia, _ = build_folder_structure(base_dest, hoy.year, hoy.month, hoy.day, MESES)
        patient_folder = os.path.join(ruta_dia, patient)

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

        # Requisito: Validar con realpath/abspath que el resultado sigue DENTRO de base_dest
        base_dest_abs = os.path.realpath(base_dest)
        patient_folder_abs = os.path.realpath(patient_folder)
        dest_doc_path_abs = os.path.realpath(dest_doc_path)
        
        try:
            if os.path.commonpath([base_dest_abs, patient_folder_abs]) != base_dest_abs:
                return {"ok": False, "error": "Acceso no autorizado: la ruta de la carpeta del paciente está fuera del directorio destino."}
            if os.path.commonpath([base_dest_abs, dest_doc_path_abs]) != base_dest_abs:
                return {"ok": False, "error": "Acceso no autorizado: la ruta del documento de destino está fuera del directorio destino."}
        except ValueError:
            return {"ok": False, "error": "Acceso no autorizado: rutas en diferentes unidades de disco."}

        # Crear el directorio destino solo después de validar la seguridad del path
        os.makedirs(patient_folder, exist_ok=True)

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

        # 1. Conversión Word -> PDF vía instancia persistente
        word, error = get_word_app()
        if not word:
            return {"ok": False, "error": f"No se pudo obtener el motor de Microsoft Word: {error}"}

        try:
            doc = word.Documents.Open(doc_path, ReadOnly=False)
            doc.SaveAs(pdf_path, FileFormat=17) # 17 = wdFormatPDF
            doc.Close(SaveChanges=False)
            # NO llamar a word.Quit() para mantenerlo "caliente"
        except Exception as e:
            return {"ok": False, "error": f"Error en conversión PDF: {str(e)}"}

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
            request_id = request.get("id")

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

            send_response(response, request_id)
        except Exception as e:
            send_response({"ok": False, "error": f"Error inesperado: {str(e)}"}, request.get("id") if 'request' in locals() else None)

if __name__ == "__main__":
    main()
