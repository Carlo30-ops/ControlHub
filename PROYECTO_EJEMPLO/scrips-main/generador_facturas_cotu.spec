# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec para Generador de Reportes COTU
# Genera un .exe único que incluye Python, tkinter, pandas y openpyxl.

a = Analysis(
    ['generador_facturas_cotu.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'pandas',
        'openpyxl',
        'openpyxl.cell',
        'openpyxl.cell.cell',
        'openpyxl.styles',
        'openpyxl.utils',
        'openpyxl.worksheet',
        'openpyxl.workbook',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='GeneradorCOTU',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
