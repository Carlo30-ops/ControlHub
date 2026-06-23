# Generador de Reportes COTU

Aplicación de escritorio para generar reportes Excel o CSV de facturas COTU por día, semana, mes o año, a partir de una estructura de carpetas.

## Requisitos

- Python 3.11 o 3.12
- `pandas`, `openpyxl` (`pip install -r requirements.txt`)

## Uso

```bash
pip install -r requirements.txt
python generador_facturas_cotu.py
```

## Estructura de carpetas esperada

```
AÑO / MES / DÍA / ASEGURADORA / COTUxxxxx
```

Ejemplo: `FACTURACION\2025\12-DICIEMBRE\23 DE DICIEMBRE\SOLIDARIA\COTU74335`

El botón **"Ver estructura de carpetas esperada"** dentro de la app muestra el esquema completo.

## Crear ejecutable e instalador (Windows)

1. **Ejecutable portable:** ejecutar `crear_instalador.bat` → genera `dist\GeneradorCOTU.exe`. Copiar ese .exe al otro PC.
2. **Instalador (Setup con desinstalador):** instalar [Inno Setup](https://jrsoftware.org/isinfo.php), luego ejecutar `generar_setup.bat` → genera `dist_installer\Setup_GeneradorCOTU.exe`. Entregar ese instalador; en el otro PC se instala con menú Inicio y desinstalador en “Agregar o quitar programas”.

Recomendación: ejecutar `crear_instalador.bat` desde CMD (no desde la terminal del IDE) y, si la carpeta está en OneDrive, pausar la sincronización durante el build.

## Licencia

MIT. Ver [LICENSE](LICENSE).
