import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pikepdf
except ImportError:
    pass


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
