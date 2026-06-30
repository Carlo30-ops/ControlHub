import os
import sys

# Agregar el directorio padre al path para importar pdf_utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pythoncom
    import win32com.client
except ImportError:
    pass


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
        if word:
            try:
                word.Quit()
            except Exception:
                pass
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
        if excel:
            try:
                excel.Quit()
            except Exception:
                pass
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
        if ppt:
            try:
                ppt.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()
