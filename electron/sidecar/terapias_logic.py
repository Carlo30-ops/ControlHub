"""
Lógica pura del Organizador de Terapias.
Funciones sin dependencias de GUI o configuración, para facilitar tests.
"""


def sanitize_filename(name: str) -> str:
    """Elimina caracteres inválidos para nombres de archivo en Windows y neutraliza secuencias de traversal."""
    # Reemplazar separadores de ruta y caracteres no permitidos
    invalid = '<>:"/\\|?*'
    for ch in invalid:
        name = name.replace(ch, "_")
    # Neutralizar secuencias ".."
    while ".." in name:
        name = name.replace("..", "__")
    return name.strip()


def patient_from_user_input(name_str: str) -> str:
    """
    Extrae el nombre del paciente a partir del texto introducido.
    - Si aparece 'SS' (o palabra que termina en 'SS') en medio: paciente = todo lo que va después.
    - Si 'SS' está al final: paciente = todo lo anterior.
    - Si no hay 'SS' o queda vacío: "PACIENTE_DESCONOCIDO"
    """
    parts = name_str.strip().split()
    for i, p in enumerate(parts):
        if p.upper() == "SS" or p.upper().endswith("SS"):
            if i == len(parts) - 1:
                patient = " ".join(parts[:i]).strip()
            else:
                patient = " ".join(parts[i + 1:]).strip()
            return patient if patient else "PACIENTE_DESCONOCIDO"
    return "PACIENTE_DESCONOCIDO"


def check_path_length(path: str, max_len: int = 250) -> bool:
    """Comprueba si la ruta no supera el límite de Windows."""
    return len(path) <= max_len


def build_folder_structure(base_dest: str, year: int, month: int, day: int, meses: dict) -> tuple[str, str, str, str]:
    """
    Construye las rutas de la estructura AÑO/MES/DÍA.
    Devuelve (ruta_anio, ruta_mes, ruta_dia, ruta_dia_completa).
    """
    import os
    if month not in meses:
        raise ValueError(f"Mes inválido: {month}. Debe estar entre 1 y 12.")
    anio = str(year)
    mes_nombre = f"{month:02d}- {meses[month]}"
    dia_nombre = f"{day:02d} DE {meses[month]}"
    ruta_anio = os.path.join(base_dest, anio)
    ruta_mes = os.path.join(ruta_anio, mes_nombre)
    ruta_dia = os.path.join(ruta_mes, dia_nombre)
    return ruta_anio, ruta_mes, ruta_dia, ruta_dia
