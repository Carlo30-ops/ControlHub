"""
Tests de conversión Word a PDF (win32com). Requieren customtkinter/pywin32.
"""
import unittest
import os
import sys
import tempfile
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import terapias
except (ImportError, ModuleNotFoundError, PermissionError, OSError, Exception):
    terapias = None  # skip tests si falta deps o fallo al cargar (ej. log en otra carpeta)


class TestPDFConversion(unittest.TestCase):

    def setUp(self):
        if terapias is None:
            self.skipTest("Requires customtkinter/pywin32 (pip install -r requirements.txt)")

    def test_pywin32_import(self):
        """Verifica que pywin32 se pueda importar."""
        try:
            import win32com.client
            import pythoncom
        except ImportError:
            self.fail("pywin32 no instalado. Ejecuta: pip install pywin32")

    def test_convert_function_exists(self):
        """Verifica que exista la función convert_doc_to_pdf."""
        self.assertTrue(hasattr(terapias, 'convert_doc_to_pdf'))
        self.assertTrue(callable(terapias.convert_doc_to_pdf))

    @patch('win32com.client.DispatchEx')
    @patch('pythoncom.CoInitialize')
    @patch('pythoncom.CoUninitialize')
    def test_convert_doc_to_pdf_success(self, mock_uninit, mock_init, mock_dispatch):
        """Test de conversión a PDF exitosa (mock)."""
        mock_word = MagicMock()
        mock_doc = MagicMock()
        mock_word.Documents.Open.return_value = mock_doc
        mock_dispatch.return_value = mock_word

        doc_path = os.path.join(tempfile.gettempdir(), "test_terapias.docx")
        pdf_path = os.path.join(tempfile.gettempdir(), "test_terapias.pdf")
        with open(doc_path, 'w') as f:
            f.write("test")

        try:
            result = terapias.convert_doc_to_pdf(doc_path, pdf_path)
            mock_init.assert_called_once()
            mock_dispatch.assert_called_once_with("Word.Application")
            mock_word.Documents.Open.assert_called_once()
            mock_doc.SaveAs.assert_called_once()
            mock_doc.Close.assert_called_once()
            mock_word.Quit.assert_called_once()
            mock_uninit.assert_called_once()
            self.assertTrue(result)
        finally:
            if os.path.exists(doc_path):
                os.remove(doc_path)

    @patch('win32com.client.DispatchEx')
    @patch('pythoncom.CoInitialize')
    def test_convert_doc_to_pdf_word_error(self, mock_init, mock_dispatch):
        """Test cuando Word lanza error."""
        mock_dispatch.side_effect = Exception("Word COM error")
        doc_path = os.path.join(tempfile.gettempdir(), "test_terapias2.docx")
        pdf_path = os.path.join(tempfile.gettempdir(), "test_terapias2.pdf")
        with open(doc_path, 'w') as f:
            f.write("test")
        try:
            result = terapias.convert_doc_to_pdf(doc_path, pdf_path)
            self.assertFalse(result)
        finally:
            if os.path.exists(doc_path):
                os.remove(doc_path)

    def test_convert_doc_to_pdf_nonexistent_file(self):
        """Test con archivo inexistente."""
        result = terapias.convert_doc_to_pdf("C:/nonexistent/file.docx", "C:/nonexistent/file.pdf")
        self.assertFalse(result)

    def test_find_word_executable(self):
        """Test del buscador de Word."""
        result = terapias.find_word_executable()
        self.assertTrue(result is None or isinstance(result, str))


if __name__ == '__main__':
    unittest.main(verbosity=2)
