"""
Tests unitarios para terapias_logic.py
"""
import os
import tempfile
import unittest

from terapias_logic import (
    sanitize_filename,
    patient_from_user_input,
    check_path_length,
    build_folder_structure,
)


class TestSanitizeFilename(unittest.TestCase):
    """Tests para sanitize_filename."""

    def test_caracteres_invalidos_reemplazados(self):
        # < > : " / \ | ? * = 9 caracteres reemplazados por _
        result = sanitize_filename('archivo<>:"/\\|?*doc')
        self.assertEqual(result.count("_"), 9)
        self.assertTrue(result.startswith("archivo"))
        self.assertTrue(result.endswith("doc"))

    def test_nombre_normal_sin_cambios(self):
        self.assertEqual(sanitize_filename("Informe SS Juan Pérez"), "Informe SS Juan Pérez")

    def test_espacios_al_final_eliminados(self):
        self.assertEqual(sanitize_filename("  nombre  "), "nombre")

    def test_nombre_vacio(self):
        self.assertEqual(sanitize_filename(""), "")
        self.assertEqual(sanitize_filename("   "), "")

    def test_solo_caracteres_invalidos(self):
        result = sanitize_filename("<>:\\|?*")
        self.assertTrue(all(c == "_" for c in result))
        self.assertGreater(len(result), 0)


class TestPatientFromUserInput(unittest.TestCase):
    """Tests para patient_from_user_input."""

    def test_ss_en_medio(self):
        self.assertEqual(patient_from_user_input("Informe SS Juan Pérez"), "Juan Pérez")
        self.assertEqual(patient_from_user_input("Informe SS María García López"), "María García López")

    def test_ss_al_final(self):
        self.assertEqual(patient_from_user_input("Juan Pérez SS"), "Juan Pérez")
        self.assertEqual(patient_from_user_input("María García SS"), "María García")

    def test_sin_ss(self):
        self.assertEqual(patient_from_user_input("Informe general"), "PACIENTE_DESCONOCIDO")
        self.assertEqual(patient_from_user_input("Solo una palabra"), "PACIENTE_DESCONOCIDO")

    def test_ss_solo_palabra_siguiente_vacia(self):
        # "Informe SS" - SS al final, paciente = todo lo anterior = "Informe"
        self.assertEqual(patient_from_user_input("Informe SS"), "Informe")

    def test_ss_al_inicio(self):
        self.assertEqual(patient_from_user_input("SS Juan Pérez"), "Juan Pérez")

    def test_palabra_termina_en_ss(self):
        self.assertEqual(patient_from_user_input("Informe FSS María"), "María")
        self.assertEqual(patient_from_user_input("Algo SS María"), "María")

    def test_espacios_extra(self):
        self.assertEqual(patient_from_user_input("  Informe SS  Juan  "), "Juan")

    def test_ss_minusculas(self):
        self.assertEqual(patient_from_user_input("informe ss juan pérez"), "juan pérez")


class TestCheckPathLength(unittest.TestCase):
    """Tests para check_path_length."""

    def test_ruta_corta(self):
        self.assertTrue(check_path_length("C:\\carpeta\\archivo.docx"))
        self.assertTrue(check_path_length("a" * 100))

    def test_ruta_en_limite(self):
        self.assertTrue(check_path_length("a" * 250, max_len=250))

    def test_ruta_muy_larga(self):
        self.assertFalse(check_path_length("a" * 300, max_len=250))
        self.assertFalse(check_path_length("a" * 251, max_len=250))

    def test_max_len_personalizado(self):
        self.assertTrue(check_path_length("abc", max_len=5))
        self.assertFalse(check_path_length("abcdef", max_len=5))


class TestBuildFolderStructure(unittest.TestCase):
    """Tests para build_folder_structure."""

    def setUp(self):
        self.meses = {
            1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
            5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
            9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE",
        }

    def test_estructura_correcta(self):
        base = "C:\\TERAPIAS"
        ruta_anio, ruta_mes, ruta_dia, ruta_dia_full = build_folder_structure(base, 2026, 1, 28, self.meses)
        self.assertEqual(ruta_anio, os.path.join(base, "2026"))
        self.assertEqual(ruta_mes, os.path.join(base, "2026", "01- ENERO"))
        self.assertEqual(ruta_dia, os.path.join(base, "2026", "01- ENERO", "28 DE ENERO"))
        self.assertEqual(ruta_dia_full, ruta_dia)

    def test_diciembre(self):
        base = "C:\\TEST"
        _, _, ruta_dia, _ = build_folder_structure(base, 2025, 12, 1, self.meses)
        self.assertIn("12- DICIEMBRE", ruta_dia)
        self.assertIn("01 DE DICIEMBRE", ruta_dia)

    def test_mes_invalido_levanta_error(self):
        """Mes fuera de rango (0 o 13) debe levantar ValueError."""
        base = "C:\\TEST"
        with self.assertRaises(ValueError):
            build_folder_structure(base, 2025, 0, 1, self.meses)
        with self.assertRaises(ValueError):
            build_folder_structure(base, 2025, 13, 1, self.meses)


if __name__ == "__main__":
    unittest.main()
