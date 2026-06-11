"""
Script de validación para verificar que Microsoft Word esté instalado.
Usado para el sistema de conversión de documentos a PDF.
"""
import sys
import subprocess
import winreg


def check_word_in_registry():
    """Verifica si Word está registrado en el sistema Windows."""
    try:
        # Intentar abrir las claves comunes de registro de Word
        possible_keys = [
            r"SOFTWARE\Microsoft\Office\16.0\Word\InstallRoot",
            r"SOFTWARE\Microsoft\Office\15.0\Word\InstallRoot",
            r"SOFTWARE\Microsoft\Office\14.0\Word\InstallRoot",
            r"SOFTWARE\WOW6432Node\Microsoft\Office\16.0\Word\InstallRoot",
            r"SOFTWARE\WOW6432Node\Microsoft\Office\15.0\Word\InstallRoot",
            r"SOFTWARE\WOW6432Node\Microsoft\Office\14.0\Word\InstallRoot",
        ]
        
        for key_path in possible_keys:
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path)
                path = winreg.QueryValueEx(key, "Path")[0]
                winreg.CloseKey(key)
                if path:
                    return True, f"Word encontrado en registro: {path}"
            except WindowsError:
                continue
        
        return False, "Word no encontrado en el registro"
    except Exception as e:
        return False, f"Error al verificar registro: {e}"


def check_word_executable():
    """Intenta ejecutar winword.exe para verificar que esté accesible."""
    try:
        # Intentar ejecutar Word con el parámetro /? (no abre el programa)
        result = subprocess.run(
            ["winword.exe", "/?"],
            capture_output=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        return True, "winword.exe es accesible desde PATH"
    except subprocess.TimeoutExpired:
        # Timeout puede significar que Word se está ejecutando
        return True, "winword.exe respondió (timeout esperado)"
    except FileNotFoundError:
        return False, "winword.exe no encontrado en PATH"
    except Exception as e:
        return False, f"Error al ejecutar winword.exe: {e}"


def check_word_com():
    """Verifica que Word esté disponible a través de COM (win32com)."""
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        version = word.Version
        word.Quit()
        return True, f"Word disponible vía COM (versión {version})"
    except ImportError:
        return False, "pywin32 no está instalado (requerido para COM)"
    except Exception as e:
        return False, f"Error al acceder Word vía COM: {e}"


def main():
    """Ejecuta todas las verificaciones y muestra el resultado."""
    print("=" * 60)
    print("Verificación de Instalación de Microsoft Word")
    print("=" * 60)
    print()
    
    checks = [
        ("Registro de Windows", check_word_in_registry),
        ("Ejecutable en PATH", check_word_executable),
        ("Acceso COM/Automation", check_word_com),
    ]
    
    all_passed = True
    
    for check_name, check_func in checks:
        print(f"[*] Verificando: {check_name}")
        success, message = check_func()
        
        if success:
            print(f"    ✓ ÉXITO: {message}")
        else:
            print(f"    ✗ FALLO: {message}")
            all_passed = False
        print()
    
    print("=" * 60)
    if all_passed:
        print("✓ Microsoft Word está correctamente instalado y accesible")
        print("=" * 60)
        return 0
    else:
        print("✗ Word no está completamente disponible")
        print("  Asegúrese de tener Microsoft Word instalado.")
        print("  La conversión automática a PDF puede no funcionar.")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
