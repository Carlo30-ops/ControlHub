"""
Generador de Reportes de Facturas COTU
Aplicación unificada para generar reportes diarios, semanales, mensuales y anuales
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import sys
import subprocess
import threading
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import re
import json
import logging

_log = logging.getLogger("GeneradorCOTU")


def _configurar_logging():
    """Configura logging a consola y, si es posible, a archivo en APPDATA/GeneradorCOTU."""
    _log.setLevel(logging.INFO)
    try:
        log_dir = os.path.join(
            os.environ.get("APPDATA") or os.environ.get("HOME") or os.path.dirname(os.path.abspath(__file__)),
            "GeneradorCOTU",
        )
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "generador_cotu.log")
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setLevel(logging.INFO)
        fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
        _log.addHandler(fh)
    except OSError:
        pass


def _tooltip(widget, texto):
    """Muestra texto al pasar el ratón sobre el widget."""
    tip = [None]
    def _show(_e):
        if tip[0]:
            return
        x = widget.winfo_rootx() + 10
        y = widget.winfo_rooty() + widget.winfo_height() + 2
        tip[0] = tw = tk.Toplevel(widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        tk.Label(tw, text=texto, justify=tk.LEFT, background="#ffffe0", relief=tk.SOLID, borderwidth=1, font=("Arial", 9)).pack()
    def _hide(_e):
        if tip[0]:
            tip[0].destroy()
            tip[0] = None
    widget.bind("<Enter>", _show)
    widget.bind("<Leave>", _hide)


class GeneradorFacturasCOTU:
    def __init__(self, root):
        self.root = root
        self.root.title("Generador de Reportes COTU")
        self.root.geometry("700x700")
        self.root.resizable(True, True)
        
        # Variables de tema y config
        self.tema_oscuro = False
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.config_file = os.path.join(script_dir, "config.json")
        # Historial en carpeta de usuario (APPDATA en Windows)
        appdata = os.environ.get("APPDATA") or os.environ.get("HOME") or script_dir
        self._historial_dir = os.path.join(appdata, "GeneradorCOTU")
        os.makedirs(self._historial_dir, exist_ok=True)
        self.historial_file = os.path.join(self._historial_dir, "historial_reportes.json")
        
        # Cargar config (última carpeta, tema)
        self._cargar_config()
        
        # Estilo
        self.setup_styles()
        
        # Variables
        self.ruta_base = tk.StringVar(value=getattr(self, "_ultima_carpeta", "") or "")
        self.tipo_reporte = tk.StringVar(value="Año")
        self.fecha_inicio = tk.StringVar()
        self.fecha_fin = tk.StringVar()
        self.formato_resumido = tk.BooleanVar(value=getattr(self, "_formato_resumido", False))
        self.solo_carpetas_cotu = tk.BooleanVar(value=getattr(self, "_solo_carpetas_cotu", True))
        
        # Variables para vista previa
        self.registros_preview = []
        
        # Atributos del calendario (se usan al abrir el selector de fecha)
        self.cal_anio = datetime.now().year
        self.cal_mes = datetime.now().month
        self.mes_label = None
        self.dias_frame = None
        
        self.crear_interfaz()
        
        # Aplicar tema guardado
        if self.tema_oscuro:
            self.btn_tema.config(text="☀️ Tema Claro")
            ttk.Style().theme_use('alt')
        self.aplicar_tema()

    def _cargar_config(self):
        """Carga última carpeta, tema y formato desde config.json"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                self._ultima_carpeta = cfg.get("ultima_carpeta", "")
                self.tema_oscuro = cfg.get("tema_oscuro", False)
                self._formato_resumido = cfg.get("formato_resumido", False)
                self._solo_carpetas_cotu = cfg.get("solo_carpetas_cotu", True)
            else:
                self._ultima_carpeta = ""
                self._formato_resumido = False
                self._solo_carpetas_cotu = True
        except (OSError, json.JSONDecodeError, ValueError):
            self._ultima_carpeta = ""
            self._formato_resumido = False
            self._solo_carpetas_cotu = True
    
    def _guardar_config(self):
        """Guarda última carpeta, tema y formato en config.json"""
        try:
            cfg = {
                "ultima_carpeta": self.ruta_base.get() or getattr(self, "_ultima_carpeta", ""),
                "tema_oscuro": self.tema_oscuro,
                "formato_resumido": self.formato_resumido.get(),
                "solo_carpetas_cotu": self.solo_carpetas_cotu.get(),
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
        except (OSError, TypeError, ValueError):
            pass
    
    def _mostrar_estructura_esperada(self):
        """Muestra ventana con la estructura de carpetas que el programa espera."""
        texto = """Estructura estándar (como en el script de trabajo):

  AÑO (carpeta raíz que usted selecciona)
  └── MES (ej. 12-DICIEMBRE o DICIEMBRE)
      └── DÍA (ej. 23 DE DICIEMBRE)
          └── ASEGURADORA (ej. SOLIDARIA, AURORA, BOLIVAR)
              └── COTUxxxxx (carpeta de la factura; nombre empieza por COTU)

El programa toma desde el final de la ruta:
  AÑO = 5 niveles arriba, MES = 4, DÍA = 3, ASEGURADORA = 2, COTU = carpeta actual.

Ejemplo PC trabajo:
  FACTURACION\\2025\\12-DICIEMBRE\\23 DE DICIEMBRE\\SOLIDARIA\\COTU74335
  → AÑO=2025, MES=12-DICIEMBRE, DÍA=23 DE DICIEMBRE, ASEGURADORA=SOLIDARIA

Ejemplo PC casa (también válido):
  FACTURACION\\2025\\DICIEMBRE\\13 DE DICIEMBRE\\AURORA\\COTU 12345

• "Carpeta del Año" = la carpeta 2025 (o FACTURACION si tiene 2025 dentro).
• Solo se cuentan carpetas cuyo nombre empiece por COTU (o todas si desmarca la opción)."""
        ventana = tk.Toplevel(self.root)
        ventana.title("Estructura de carpetas esperada")
        ventana.geometry("520x340")
        ventana.transient(self.root)
        txt = tk.Text(ventana, wrap=tk.WORD, font=("Consolas", 10), padx=12, pady=12)
        txt.pack(fill=tk.BOTH, expand=True)
        txt.insert("1.0", texto)
        txt.config(state=tk.DISABLED)
        ttk.Button(ventana, text="Cerrar", command=ventana.destroy).pack(pady=(0, 10))
    
    def setup_styles(self):
        """Configura estilos para la interfaz"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Colores personalizados
        style.configure('Title.TLabel', font=('Arial', 16, 'bold'))
        style.configure('Heading.TLabel', font=('Arial', 11, 'bold'))
        style.configure('Action.TButton', font=('Arial', 10, 'bold'))
    
    def _configurar_colores_ttk(self, style, bg, fg):
        """Configura colores de fondo y texto en todos los estilos ttk usados."""
        for name in ("TFrame", "TLabel", "TLabelFrame", "TButton", "TEntry", "TRadiobutton", "TCheckbutton", "TProgressbar"):
            try:
                style.configure(name, background=bg, foreground=fg)
            except tk.TclError:
                pass
        try:
            style.configure("TLabelFrame.Label", background=bg, foreground=fg)
        except tk.TclError:
            pass
        try:
            style.configure("Treeview", fieldbackground=bg, background=bg, foreground=fg)
            style.configure("Treeview.Heading", background=bg, foreground=fg)
        except tk.TclError:
            pass
        for custom in ("Title.TLabel", "Heading.TLabel", "Action.TButton"):
            try:
                style.configure(custom, background=bg, foreground=fg)
            except tk.TclError:
                pass

    def aplicar_tema(self):
        """Aplica tema oscuro o claro (ventana y widgets ttk)."""
        if self.tema_oscuro:
            bg_color, fg_color = "#2b2b2b", "#e0e0e0"
        else:
            bg_color, fg_color = "#f0f0f0", "#000000"
        self.root.configure(bg=bg_color)
        style = ttk.Style()
        self._configurar_colores_ttk(style, bg_color, fg_color)
    
    def crear_interfaz(self):
        """Crea la interfaz gráfica"""
        # Frame principal
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Título
        title = ttk.Label(
            main_frame, 
            text="📊 Generador de Reportes COTU", 
            style='Title.TLabel'
        )
        title.pack(pady=(0, 20))
        
        # Sección: Selección de carpeta base
        folder_frame = ttk.LabelFrame(main_frame, text="Ubicación de Facturas", padding="15")
        folder_frame.pack(fill=tk.X, pady=(0, 15))
        
        ttk.Label(folder_frame, text="Carpeta del Año:").pack(anchor=tk.W)
        
        folder_path_frame = ttk.Frame(folder_frame)
        folder_path_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.path_entry = ttk.Entry(folder_path_frame, textvariable=self.ruta_base, width=50)
        self.path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        ttk.Button(
            folder_path_frame, 
            text="📁 Buscar", 
            command=self.seleccionar_carpeta
        ).pack(side=tk.LEFT)
        
        # Sección: Tipo de reporte
        report_frame = ttk.LabelFrame(main_frame, text="📅 Tipo de Reporte", padding="15")
        report_frame.pack(fill=tk.X, pady=(0, 15))
        
        tipos = [
            ("📆 Año Completo", "Año", "Genera reporte de todo el año seleccionado"),
            ("📅 Mes", "Mes", "Genera reporte de un rango de fechas (mes)"),
            ("📊 Semana", "Semana", "Genera reporte de un rango de fechas (semana)"),
            ("📝 Día", "Día", "Genera reporte de un día específico")
        ]
        
        # Crear radio buttons con descripciones
        for text, value, descripcion in tipos:
            radio_frame = ttk.Frame(report_frame)
            radio_frame.pack(anchor=tk.W, pady=3, fill=tk.X)
            
            ttk.Radiobutton(
                radio_frame,
                text=text,
                variable=self.tipo_reporte,
                value=value,
                command=self.actualizar_campos_fecha
            ).pack(side=tk.LEFT)
            
            # Descripción pequeña
            desc_label = ttk.Label(
                radio_frame, 
                text=f" - {descripcion}", 
                font=('Arial', 8),
                foreground='gray'
            )
            desc_label.pack(side=tk.LEFT, padx=(5, 0))
        
        # Formato del Excel y opciones de detección
        formato_frame = ttk.Frame(report_frame)
        formato_frame.pack(anchor=tk.W, pady=(8, 0))
        ttk.Checkbutton(
            formato_frame,
            text="Formato resumido (solo FECHA, COTU, ASEGURADORA)",
            variable=self.formato_resumido,
            command=self._guardar_config
        ).pack(anchor=tk.W)
        ttk.Checkbutton(
            formato_frame,
            text="Solo carpetas cuyo nombre empiece por 'COTU' (desmarcar = todas las carpetas bajo aseguradora)",
            variable=self.solo_carpetas_cotu,
            command=self._guardar_config
        ).pack(anchor=tk.W)
        ttk.Button(
            formato_frame,
            text="📋 Ver estructura de carpetas esperada",
            command=self._mostrar_estructura_esperada
        ).pack(anchor=tk.W, pady=(5, 0))
        
        # Sección: Fechas (inicialmente oculta)
        self.date_frame = ttk.LabelFrame(main_frame, text="📆 Rango de Fechas", padding="15")
        
        date_input_frame = ttk.Frame(self.date_frame)
        date_input_frame.pack(fill=tk.X)
        
        # Fecha inicio con calendario
        ttk.Label(date_input_frame, text="Desde:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        fecha_inicio_frame = ttk.Frame(date_input_frame)
        fecha_inicio_frame.grid(row=0, column=1, padx=(0, 20))
        self.fecha_inicio_entry = ttk.Entry(fecha_inicio_frame, textvariable=self.fecha_inicio, width=15)
        self.fecha_inicio_entry.pack(side=tk.LEFT)
        ttk.Button(fecha_inicio_frame, text="📅", width=3, command=lambda: self.abrir_calendario("inicio")).pack(side=tk.LEFT, padx=(2, 0))
        ttk.Label(date_input_frame, text="(DD/MM/YYYY)").grid(row=0, column=2, sticky=tk.W)
        
        # Fecha fin con calendario
        ttk.Label(date_input_frame, text="Hasta:").grid(row=0, column=3, sticky=tk.W, padx=(0, 5))
        fecha_fin_frame = ttk.Frame(date_input_frame)
        fecha_fin_frame.grid(row=0, column=4, padx=(0, 20))
        self.fecha_fin_entry = ttk.Entry(fecha_fin_frame, textvariable=self.fecha_fin, width=15)
        self.fecha_fin_entry.pack(side=tk.LEFT)
        ttk.Button(fecha_fin_frame, text="📅", width=3, command=lambda: self.abrir_calendario("fin")).pack(side=tk.LEFT, padx=(2, 0))
        ttk.Label(date_input_frame, text="(DD/MM/YYYY)").grid(row=0, column=5, sticky=tk.W)
        
        self.date_frame.pack_forget()  # Ocultar inicialmente
        
        # Botones de acción
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(10, 0))
        
        # Botón de vista previa
        self.btn_preview = ttk.Button(
            button_frame,
            text="👁️ Vista Previa",
            command=self.mostrar_vista_previa
        )
        self.btn_preview.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        # Botón de generación
        self.btn_generar = ttk.Button(
            button_frame,
            text="🚀 Generar Excel",
            command=self.generar_reporte,
            style='Action.TButton'
        )
        self.btn_generar.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 2))
        
        # Botón exportar CSV
        self.btn_csv = ttk.Button(
            button_frame,
            text="📄 Exportar CSV",
            command=self.exportar_csv
        )
        self.btn_csv.pack(side=tk.LEFT, fill=tk.X, padx=(2, 0))
        
        # Botones adicionales en otra fila
        tools_frame = ttk.Frame(main_frame)
        tools_frame.pack(fill=tk.X, pady=(5, 0))
        
        # Botón de historial
        btn_hist = ttk.Button(tools_frame, text="📋 Historial", command=self.mostrar_historial)
        btn_hist.pack(side=tk.LEFT, padx=(0, 5))
        
        # Botón de tema
        self.btn_tema = ttk.Button(
            tools_frame,
            text="🌙 Tema Oscuro",
            command=self.toggle_tema
        )
        self.btn_tema.pack(side=tk.LEFT)
        
        # Tooltips
        _tooltip(self.btn_preview, "Ver facturas encontradas antes de generar el Excel")
        _tooltip(self.btn_generar, "Generar archivo Excel con las facturas COTU")
        _tooltip(btn_hist, "Ver reportes generados anteriormente")
        _tooltip(self.btn_tema, "Cambiar entre tema oscuro y claro")
        
        # Atajos de teclado
        self.root.bind("<Control-o>", lambda e: self.seleccionar_carpeta())
        self.root.bind("<Control-g>", lambda e: self.generar_reporte())
        self.root.bind("<Control-p>", lambda e: self.mostrar_vista_previa())
        self.root.bind("<Control-h>", lambda e: self.mostrar_historial())
        
        # Barra de progreso
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.pack(fill=tk.X, pady=(10, 0))
        
        # Estado
        self.status_label = ttk.Label(main_frame, text="Listo para generar reporte", foreground="green")
        self.status_label.pack(pady=(10, 0))
    
    def seleccionar_carpeta(self):
        """Abre diálogo para seleccionar carpeta del año"""
        inicial = self.ruta_base.get() or getattr(self, "_ultima_carpeta", "")
        carpeta = filedialog.askdirectory(title="Selecciona la carpeta del AÑO", initialdir=inicial or None)
        if carpeta:
            self.ruta_base.set(carpeta)
            self._ultima_carpeta = carpeta
            self._guardar_config()
            self.actualizar_status(f"Carpeta seleccionada: {os.path.basename(carpeta)}", "blue")
    
    def actualizar_campos_fecha(self):
        """Muestra/oculta campos de fecha según el tipo de reporte"""
        tipo = self.tipo_reporte.get()
        
        if tipo in ["Mes", "Semana", "Día"]:
            # Mostrar frame de fechas
            self.date_frame.pack(fill=tk.X, pady=(0, 15), before=self.btn_generar.master)
            
            if tipo == "Día":
                # Para día, solo necesitamos fecha de inicio
                self.fecha_fin_entry.config(state='disabled')
                self.fecha_fin.set("")
            else:
                # Para mes y semana, necesitamos ambas fechas
                self.fecha_fin_entry.config(state='normal')
        else:
            # Para año completo, ocultar campos de fecha
            self.date_frame.pack_forget()
            self.fecha_inicio.set("")
            self.fecha_fin.set("")
    
    def actualizar_status(self, mensaje, color="black"):
        """Actualiza el mensaje de estado"""
        self.status_label.config(text=mensaje, foreground=color)
        self.root.update()
    
    def abrir_calendario(self, tipo_fecha):
        """Abre un selector de calendario simple"""
        ventana_cal = tk.Toplevel(self.root)
        ventana_cal.title("Seleccionar Fecha")
        ventana_cal.geometry("300x300")
        ventana_cal.transient(self.root)
        ventana_cal.grab_set()
        
        # Frame para el calendario
        cal_frame = ttk.Frame(ventana_cal, padding="10")
        cal_frame.pack(fill=tk.BOTH, expand=True)
        
        # Año y mes actual
        hoy = datetime.now()
        self.cal_anio = hoy.year
        self.cal_mes = hoy.month
        
        # Controles de mes/año
        control_frame = ttk.Frame(cal_frame)
        control_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(control_frame, text="◀", width=3, command=lambda: self.cambiar_mes(-1, cal_frame, tipo_fecha, ventana_cal)).pack(side=tk.LEFT)
        self.mes_label = ttk.Label(control_frame, text=f"{self.obtener_nombre_mes(self.cal_mes)} {self.cal_anio}", font=('Arial', 10, 'bold'))
        self.mes_label.pack(side=tk.LEFT, expand=True)
        ttk.Button(control_frame, text="▶", width=3, command=lambda: self.cambiar_mes(1, cal_frame, tipo_fecha, ventana_cal)).pack(side=tk.LEFT)
        
        # Frame para días
        self.dias_frame = ttk.Frame(cal_frame)
        self.dias_frame.pack(fill=tk.BOTH, expand=True)
        
        self.dibujar_calendario(cal_frame, tipo_fecha, ventana_cal)
        
        # Botón cancelar
        ttk.Button(cal_frame, text="Cancelar", command=ventana_cal.destroy).pack(pady=(10, 0))
    
    def obtener_nombre_mes(self, mes):
        """Obtiene el nombre del mes en español"""
        meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        return meses[mes - 1]
    
    def cambiar_mes(self, direccion, _parent, tipo_fecha, ventana):
        """Cambia el mes en el calendario"""
        self.cal_mes += direccion
        if self.cal_mes > 12:
            self.cal_mes = 1
            self.cal_anio += 1
        elif self.cal_mes < 1:
            self.cal_mes = 12
            self.cal_anio -= 1
        
        self.mes_label.config(text=f"{self.obtener_nombre_mes(self.cal_mes)} {self.cal_anio}")
        self.dibujar_calendario(_parent, tipo_fecha, ventana)
    
    def dibujar_calendario(self, _parent, tipo_fecha, ventana):
        """Dibuja el calendario"""
        # Limpiar frame de días
        for widget in self.dias_frame.winfo_children():
            widget.destroy()
        
        # Días de la semana
        dias_semana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        for i, dia in enumerate(dias_semana):
            ttk.Label(self.dias_frame, text=dia, font=('Arial', 8, 'bold')).grid(row=0, column=i, padx=2, pady=2)
        
        # Primer día del mes
        primer_dia = datetime(self.cal_anio, self.cal_mes, 1)
        dia_semana = primer_dia.weekday()  # 0 = Lunes
        
        # Días del mes
        if self.cal_mes == 12:
            ultimo_dia = datetime(self.cal_anio + 1, 1, 1) - timedelta(days=1)
        else:
            ultimo_dia = datetime(self.cal_anio, self.cal_mes + 1, 1) - timedelta(days=1)
        
        num_dias = ultimo_dia.day
        fila = 1
        col = dia_semana
        
        for dia in range(1, num_dias + 1):
            btn = ttk.Button(
                self.dias_frame,
                text=str(dia),
                width=3,
                command=lambda d=dia: self.seleccionar_fecha(d, tipo_fecha, ventana)
            )
            btn.grid(row=fila, column=col, padx=1, pady=1)
            col += 1
            if col > 6:
                col = 0
                fila += 1
    
    def seleccionar_fecha(self, dia, tipo_fecha, ventana):
        """Selecciona una fecha del calendario"""
        fecha = datetime(self.cal_anio, self.cal_mes, dia)
        fecha_str = fecha.strftime("%d/%m/%Y")
        
        if tipo_fecha == "inicio":
            self.fecha_inicio.set(fecha_str)
        else:
            self.fecha_fin.set(fecha_str)
        
        ventana.destroy()
    
    def mostrar_vista_previa(self):
        """Muestra una vista previa de las facturas encontradas"""
        if not self.ruta_base.get():
            messagebox.showwarning("Aviso", "Por favor, selecciona primero la carpeta del año")
            return
        
        # Extraer facturas
        try:
            tipo = self.tipo_reporte.get()
            fecha_inicio = None
            fecha_fin = None
            
            if tipo in ["Mes", "Semana", "Día"]:
                if not self.fecha_inicio.get():
                    messagebox.showwarning("Aviso", "Por favor, ingresa las fechas para la vista previa")
                    return
                fecha_inicio = self.validar_fecha(self.fecha_inicio.get())
                if not fecha_inicio:
                    messagebox.showerror("Error", "Formato de fecha inválido")
                    return
                if tipo != "Día":
                    fecha_fin = self.validar_fecha(self.fecha_fin.get()) if self.fecha_fin.get() else None
                else:
                    fecha_fin = fecha_inicio
            
            registros = self.extraer_facturas(self.ruta_base.get(), fecha_inicio, fecha_fin)
            
            if tipo != "Año":
                registros = self.filtrar_por_tipo(registros, tipo, self.fecha_inicio.get(), self.fecha_fin.get())
            
            if not registros:
                messagebox.showinfo("Vista Previa", "No se encontraron facturas con los criterios seleccionados")
                return
            
            # Crear ventana de vista previa
            ventana_preview = tk.Toplevel(self.root)
            ventana_preview.title("Vista Previa de Facturas")
            ventana_preview.geometry("800x550")
            
            # Búsqueda
            busqueda_frame = ttk.Frame(ventana_preview)
            busqueda_frame.pack(fill=tk.X, padx=10, pady=(10, 5))
            ttk.Label(busqueda_frame, text="Buscar:").pack(side=tk.LEFT, padx=(0, 5))
            var_busqueda = tk.StringVar()
            entry_busqueda = ttk.Entry(busqueda_frame, textvariable=var_busqueda, width=40)
            entry_busqueda.pack(side=tk.LEFT, fill=tk.X, expand=True)
            
            # Frame con scrollbar
            frame_scroll = ttk.Frame(ventana_preview)
            frame_scroll.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
            
            scrollbar = ttk.Scrollbar(frame_scroll)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            
            # Treeview para mostrar datos
            columnas = ["AÑO", "MES", "FECHA DE LA FACTURA", "N° FACTURA", "DETALLE COMPLETO", "COMPAÑÍA"]
            tree = ttk.Treeview(frame_scroll, yscrollcommand=scrollbar.set, show='headings')
            tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            scrollbar.config(command=tree.yview)
            
            tree['columns'] = columnas
            for col in columnas:
                tree.heading(col, text=col)
                tree.column(col, width=120)
            
            # Insertar datos (guardar para filtrado)
            listado_preview = list(registros[:100])
            
            def _refiltrar(*_args):
                texto = var_busqueda.get().strip().upper()
                for i in tree.get_children():
                    tree.delete(i)
                for registro in listado_preview:
                    if not texto or any(texto in str(registro.get(c, "")).upper() for c in columnas):
                        valores = [registro.get(col, "") for col in columnas]
                        tree.insert("", tk.END, values=valores)
            
            for registro in listado_preview:
                valores = [registro.get(col, "") for col in columnas]
                tree.insert("", tk.END, values=valores)
            
            var_busqueda.trace_add("write", _refiltrar)
            
            # Información
            info_label = ttk.Label(
                ventana_preview,
                text=f"Total encontradas: {len(registros)} facturas (mostrando primeras 100). Escribe arriba para filtrar."
            )
            info_label.pack(pady=5)
            
        except Exception as e:
            messagebox.showerror("Error", f"Error al generar vista previa:\n{str(e)}")
    
    def mostrar_historial(self):
        """Muestra el historial de reportes generados"""
        historial = self.cargar_historial()
        
        ventana_hist = tk.Toplevel(self.root)
        ventana_hist.title("Historial de Reportes")
        ventana_hist.geometry("700x400")
        
        # Frame con scrollbar
        frame_scroll = ttk.Frame(ventana_hist)
        frame_scroll.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        scrollbar = ttk.Scrollbar(frame_scroll)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Treeview
        tree = ttk.Treeview(frame_scroll, yscrollcommand=scrollbar.set, show='headings')
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=tree.yview)
        
        # Columnas
        columnas = ["Fecha", "Tipo", "Archivo", "Ruta", "Facturas"]
        tree['columns'] = columnas
        
        for col in columnas:
            tree.heading(col, text=col)
            tree.column(col, width=150)
        
        # Insertar datos (guardar ruta completa en tags para doble clic)
        for item in historial:
            ruta_completa = item.get("ruta", "")
            valores = [
                item.get("fecha", ""),
                item.get("tipo", ""),
                item.get("archivo", ""),
                ruta_completa[:50] + "..." if len(ruta_completa) > 50 else ruta_completa,
                str(item.get("total_facturas", 0))
            ]
            tree.insert("", tk.END, values=valores, tags=(ruta_completa,))
        
        # Doble clic: abrir carpeta del archivo
        def _al_doble_clic(_event):
            sel = tree.selection()
            if sel:
                tags = tree.item(sel[0]).get("tags", ())
                if tags:
                    ruta = tags[0]
                    if os.path.isfile(ruta):
                        self._abrir_carpeta(os.path.dirname(ruta))
                    elif os.path.isdir(ruta):
                        self._abrir_carpeta(ruta)
        
        tree.bind("<Double-1>", _al_doble_clic)
        ttk.Label(ventana_hist, text="Doble clic en una fila para abrir la carpeta").pack(pady=2)
        
        if not historial:
            ttk.Label(ventana_hist, text="No hay historial de reportes aún").pack(pady=20)
    
    def toggle_tema(self):
        """Alterna entre tema oscuro y claro."""
        self.tema_oscuro = not self.tema_oscuro
        if self.tema_oscuro:
            self.btn_tema.config(text="☀️ Tema Claro")
            ttk.Style().theme_use('alt')
        else:
            self.btn_tema.config(text="🌙 Tema Oscuro")
            ttk.Style().theme_use('clam')
        self.aplicar_tema()
        self._guardar_config()
    
    def guardar_historial(self, tipo, archivo, ruta, total_facturas):
        """Guarda un registro en el historial"""
        historial = self.cargar_historial()
        
        nuevo_registro = {
            "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "tipo": tipo,
            "archivo": archivo,
            "ruta": ruta,
            "total_facturas": total_facturas
        }
        
        historial.insert(0, nuevo_registro)
        
        # Mantener solo los últimos 50 registros
        if len(historial) > 50:
            historial = historial[:50]
        
        try:
            with open(self.historial_file, 'w', encoding='utf-8') as f:
                json.dump(historial, f, indent=2, ensure_ascii=False)
        except (OSError, TypeError, ValueError):
            pass  # Si no se puede guardar, no es crítico
    
    def cargar_historial(self):
        """Carga el historial desde archivo"""
        try:
            if os.path.exists(self.historial_file):
                with open(self.historial_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except (OSError, json.JSONDecodeError, ValueError):
            pass
        return []
    
    def _abrir_carpeta(self, carpeta):
        """Abre la carpeta en el explorador del sistema"""
        if not carpeta or not os.path.isdir(carpeta):
            return
        try:
            if sys.platform == "win32":
                os.startfile(carpeta)
            elif sys.platform == "darwin":
                subprocess.run(["open", carpeta], check=False)
            else:
                subprocess.run(["xdg-open", carpeta], check=False)
        except (OSError, subprocess.SubprocessError):
            pass
    
    def _ejecutar_csv(self, params):
        """Ejecuta en segundo plano la extracción y exportación a CSV."""
        ruta_csv, total, error_msg = None, 0, None
        try:
            registros = self.extraer_facturas(params["ruta_base"], params["fecha_inicio"], params["fecha_fin"])
            if params["tipo"] != "Año":
                registros = self.filtrar_por_tipo(registros, params["tipo"], params["fecha_inicio_str"], params["fecha_fin_str"])
            if not registros:
                res = (None, 0, "No se encontraron facturas con los criterios seleccionados")
                self.root.after(0, lambda r=res: self._al_finalizar_csv(r))
                return
            df = pd.DataFrame(registros)
            if params["formato_resumido"]:
                df = df[["FECHA DE LA FACTURA", "N° FACTURA", "COMPAÑÍA"]].copy()
                df = df.rename(columns={"FECHA DE LA FACTURA": "FECHA", "N° FACTURA": "COTU", "COMPAÑÍA": "ASEGURADORA"})
            nombre_anio = params["nombre_anio"]
            tipo, fecha_inicio, fecha_fin = params["tipo"], params["fecha_inicio"], params["fecha_fin"]
            sufijo = tipo.lower().replace("á", "a").replace("í", "i")
            if tipo == "Año":
                nombre = f"cotus_{nombre_anio}.csv"
            elif tipo == "Día":
                nombre = f"cotus_dia_{fecha_inicio.strftime('%Y%m%d')}.csv"
            else:
                nombre = f"cotus_{sufijo}_{fecha_inicio.strftime('%Y%m%d')}_{fecha_fin.strftime('%Y%m%d')}.csv"
            ruta_csv = os.path.join(params["ruta_base"], nombre)
            df.to_csv(ruta_csv, index=False, encoding="utf-8-sig")
            _log.info("CSV exportado: %s (%s facturas)", ruta_csv, len(df))
            res = (ruta_csv, len(df), None)
        except Exception as e:
            _log.exception("Error al exportar CSV")
            res = (None, 0, str(e))
        self.root.after(0, lambda r=res: self._al_finalizar_csv(r))

    def _al_finalizar_csv(self, res):
        """Callback en hilo principal tras terminar _ejecutar_csv."""
        self.progress.stop()
        self.btn_csv.config(state='normal')
        ruta_csv, total, error_msg = res
        if error_msg:
            self.actualizar_status(error_msg[:50] + "…" if len(error_msg) > 50 else error_msg, "red")
            messagebox.showerror("Error", f"Error al exportar CSV:\n{error_msg}")
        elif ruta_csv:
            self.actualizar_status("CSV exportado correctamente", "green")
            self._mostrar_exito_abrir_carpeta(ruta_csv, total)

    def exportar_csv(self):
        """Exporta el mismo conjunto de datos que el reporte actual como CSV (en segundo plano)."""
        if not self.ruta_base.get():
            messagebox.showwarning("Aviso", "Por favor, selecciona primero la carpeta del año")
            return
        tipo = self.tipo_reporte.get()
        fecha_inicio, fecha_fin = None, None
        if tipo in ["Mes", "Semana", "Día"]:
            if not self.fecha_inicio.get():
                messagebox.showwarning("Aviso", "Ingresa las fechas para exportar")
                return
            fecha_inicio = self.validar_fecha(self.fecha_inicio.get())
            if not fecha_inicio:
                messagebox.showerror("Error", "Formato de fecha inválido. Usa DD/MM/YYYY")
                return
            if tipo != "Día":
                fecha_fin = self.validar_fecha(self.fecha_fin.get()) if self.fecha_fin.get() else None
                if not fecha_fin or fecha_fin < fecha_inicio:
                    messagebox.showerror("Error", "Fecha 'Hasta' inválida o anterior a 'Desde'")
                    return
            else:
                fecha_fin = fecha_inicio
        params = {
            "ruta_base": self.ruta_base.get(),
            "tipo": tipo,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "fecha_inicio_str": self.fecha_inicio.get(),
            "fecha_fin_str": self.fecha_fin.get(),
            "formato_resumido": self.formato_resumido.get(),
            "nombre_anio": os.path.basename(self.ruta_base.get().rstrip(os.sep)),
        }
        self.progress.start()
        self.btn_csv.config(state='disabled')
        self.actualizar_status("Exportando CSV...", "blue")
        threading.Thread(target=self._ejecutar_csv, args=(params,), daemon=True).start()
    
    def _mostrar_exito_abrir_carpeta(self, ruta_salida, total_facturas):
        """Muestra diálogo de éxito con botón para abrir la carpeta"""
        ventana = tk.Toplevel(self.root)
        ventana.title("Éxito")
        ventana.geometry("500x200")
        ventana.transient(self.root)
        ventana.grab_set()
        
        ttk.Label(ventana, text="Excel generado exitosamente", font=("Arial", 11, "bold")).pack(pady=(15, 5))
        ttk.Label(ventana, text=ruta_salida, wraplength=450).pack(pady=5)
        ttk.Label(ventana, text=f"Total de facturas: {total_facturas}").pack(pady=5)
        
        btn_frame = ttk.Frame(ventana)
        btn_frame.pack(pady=15)
        ttk.Button(btn_frame, text="Abrir carpeta", command=lambda: (self._abrir_carpeta(os.path.dirname(ruta_salida)), ventana.destroy())).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Cerrar", command=ventana.destroy).pack(side=tk.LEFT, padx=5)
        
        ventana.focus_set()
    
    def validar_fecha(self, fecha_str):
        """Valida formato de fecha DD/MM/YYYY"""
        try:
            return datetime.strptime(fecha_str, "%d/%m/%Y")
        except ValueError:
            return None
    
    def extraer_facturas(self, ruta_base, fecha_inicio=None, fecha_fin=None):
        """
        Extrae todas las facturas COTU de la estructura de carpetas.
        Estructura estándar (como en script de trabajo):
          AÑO / MES / DÍA / ASEGURADORA / COTUxxxxx
        Ejemplo: 2025 / 12-DICIEMBRE / 23 DE DICIEMBRE / SOLIDARIA / COTU74335
        También admite base = carpeta padre (FACTURACION) con año en primer subnivel.
        """
        registros = []
        if not os.path.exists(ruta_base):
            raise FileNotFoundError(f"La carpeta no existe: {ruta_base}")
        nombre_anio = os.path.basename(ruta_base.rstrip(os.sep))
        solo_cotu = getattr(self, "solo_carpetas_cotu", None)
        solo_cotu = solo_cotu.get() if solo_cotu is not None else True

        for root, dirs, _ in os.walk(ruta_base):
            for d in dirs:
                if solo_cotu and not d.upper().startswith("COTU"):
                    continue
                ruta_cotu = os.path.join(root, d)
                partes = d.split()
                cotu = partes[0] if partes else d
                detalle = " ".join(partes[1:]) if len(partes) > 1 else ""
                partes_ruta = Path(ruta_cotu).parts
                try:
                    # Lógica del script de trabajo: AÑO/MES/DÍA/ASEGURADORA/COTU desde el final
                    # -1=COTU, -2=ASEGURADORA, -3=DÍA, -4=MES, -5=AÑO
                    if len(partes_ruta) >= 5:
                        anio_para_fecha = partes_ruta[-5]
                        mes = partes_ruta[-4]
                        dia = partes_ruta[-3]
                        aseguradora = partes_ruta[-2]
                    else:
                        # Fallback: índices respecto a la carpeta base
                        idx_base = partes_ruta.index(os.path.basename(ruta_base))
                        anio_para_fecha = nombre_anio
                        if idx_base + 1 < len(partes_ruta):
                            primero = partes_ruta[idx_base + 1]
                            if len(primero) == 4 and primero.isdigit():
                                anio_para_fecha = primero
                                if len(partes_ruta) > idx_base + 4:
                                    mes = partes_ruta[idx_base + 2]
                                    dia = partes_ruta[idx_base + 3]
                                    aseguradora = partes_ruta[idx_base + 4]
                                else:
                                    mes = dia = aseguradora = ""
                            else:
                                if len(partes_ruta) > idx_base + 4:
                                    mes, dia = partes_ruta[idx_base + 1], partes_ruta[idx_base + 3]
                                    aseguradora = partes_ruta[idx_base + 4]
                                elif len(partes_ruta) > idx_base + 3:
                                    mes = partes_ruta[idx_base + 1]
                                    dia = partes_ruta[idx_base + 2]
                                    aseguradora = partes_ruta[idx_base + 3]
                                else:
                                    mes = partes_ruta[idx_base + 1] if idx_base + 1 < len(partes_ruta) else ""
                                    dia = partes_ruta[idx_base + 2] if idx_base + 2 < len(partes_ruta) else ""
                                    aseguradora = ""
                        else:
                            if len(partes_ruta) > idx_base + 4:
                                mes, dia = partes_ruta[idx_base + 1], partes_ruta[idx_base + 3]
                                aseguradora = partes_ruta[idx_base + 4]
                            elif len(partes_ruta) > idx_base + 3:
                                mes, dia = partes_ruta[idx_base + 1], partes_ruta[idx_base + 2]
                                aseguradora = partes_ruta[idx_base + 3]
                            else:
                                mes = partes_ruta[idx_base + 1] if idx_base + 1 < len(partes_ruta) else ""
                                dia = partes_ruta[idx_base + 2] if idx_base + 2 < len(partes_ruta) else ""
                                aseguradora = ""
                    if fecha_inicio or fecha_fin:
                        fecha_carpeta = self.parsear_fecha_carpeta(dia, mes, anio_para_fecha)
                        if fecha_carpeta:
                            if fecha_inicio and fecha_carpeta < fecha_inicio:
                                continue
                            if fecha_fin and fecha_carpeta > fecha_fin:
                                continue
                    registros.append({
                        "AÑO": anio_para_fecha,
                        "MES": mes,
                        "FECHA DE LA FACTURA": dia,
                        "N° FACTURA": cotu,
                        "DETALLE COMPLETO": detalle,
                        "COMPAÑÍA": aseguradora
                    })
                except (IndexError, ValueError):
                    registros.append({
                        "AÑO": nombre_anio,
                        "MES": "",
                        "FECHA DE LA FACTURA": "",
                        "N° FACTURA": cotu,
                        "DETALLE COMPLETO": detalle,
                        "COMPAÑÍA": ""
                    })
        
        return registros
    
    def parsear_fecha_carpeta(self, dia, mes, anio):
        """
        Intenta parsear la fecha desde los nombres de carpeta
        Maneja formatos como: "02 DE AGOSTO", "AGOSTO", "2025"
        """
        # Diccionario de meses en español
        meses_espanol = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        }
        
        try:
            if not dia or not mes or not anio:
                return None
            
            # Extraer año (solo números)
            anio_num = None
            try:
                anio_num = int(re.sub(r'\D', '', str(anio)))
            except (ValueError, TypeError):
                return None
            
            # Extraer mes (convertir nombre a número)
            mes_num = None
            mes_lower = mes.lower().strip()
            
            # Buscar en el diccionario de meses
            if mes_lower in meses_espanol:
                mes_num = meses_espanol[mes_lower]
            else:
                # Intentar extraer número del mes (ej: "08-AGOSTO" -> 8)
                try:
                    mes_num = int(re.sub(r'\D', '', mes))
                    if mes_num < 1 or mes_num > 12:
                        # Si no es válido, buscar el nombre del mes en el string
                        for nombre_mes, num in meses_espanol.items():
                            if nombre_mes in mes_lower:
                                mes_num = num
                                break
                except (ValueError, TypeError):
                    # Buscar nombre del mes en el string
                    for nombre_mes, num in meses_espanol.items():
                        if nombre_mes in mes_lower:
                            mes_num = num
                            break
            
            if not mes_num:
                return None
            
            # Extraer día
            dia_num = None
            dia_str = str(dia).strip()
            
            # Formato: "02 DE AGOSTO" o "2 DE AGOSTO"
            # Extraer números del inicio
            match = re.match(r'^(\d+)', dia_str)
            if match:
                try:
                    dia_num = int(match.group(1))
                except (ValueError, TypeError):
                    pass
            
            # Si no se encontró día, intentar extraer cualquier número
            if not dia_num:
                try:
                    dia_num = int(re.sub(r'\D', '', dia_str))
                except (ValueError, TypeError):
                    return None
            
            # Validar y crear fecha
            if dia_num and mes_num and anio_num:
                try:
                    return datetime(anio_num, mes_num, dia_num)
                except ValueError:
                    # Fecha inválida (ej: 31 de febrero)
                    return None
                    
        except (ValueError, TypeError, AttributeError, KeyError):
            pass
        
        return None
    
    def filtrar_por_tipo(self, registros, tipo, fecha_inicio=None, fecha_fin=None):
        """Filtra registros según el tipo de reporte"""
        if tipo == "Año":
            return registros
        
        df = pd.DataFrame(registros)
        if df.empty:
            return []
        
        # Convertir fechas
        df['FECHA_PARSED'] = df.apply(
            lambda row: self.parsear_fecha_carpeta(
                row['FECHA DE LA FACTURA'], 
                row['MES'], 
                row['AÑO']
            ), axis=1
        )
        
        if fecha_inicio:
            fecha_inicio_dt = self.validar_fecha(fecha_inicio)
            if fecha_inicio_dt:
                df = df[df['FECHA_PARSED'] >= fecha_inicio_dt]
        
        if fecha_fin:
            fecha_fin_dt = self.validar_fecha(fecha_fin)
            if fecha_fin_dt:
                # Para fecha fin, incluir todo el día
                fecha_fin_dt = fecha_fin_dt.replace(hour=23, minute=59, second=59)
                df = df[df['FECHA_PARSED'] <= fecha_fin_dt]
        
        # Eliminar columna temporal
        df = df.drop('FECHA_PARSED', axis=1)
        
        return df.to_dict('records')
    
    def _ejecutar_generar(self, params):
        """Ejecuta en segundo plano la extracción y exportación del reporte. Al terminar programa callback en el hilo principal."""
        ok, ruta_salida, total, tipo, nombre_archivo, error_msg, warning_msg = False, None, 0, None, None, None, None
        try:
            registros = self.extraer_facturas(params["ruta_base"], params["fecha_inicio"], params["fecha_fin"])
            if not registros:
                res = (False, None, 0, None, None, "No se encontraron facturas COTU en el rango seleccionado.", None)
                self.root.after(0, lambda r=res: self._al_finalizar_generar(r))
                return
            if params["tipo"] != "Año":
                registros = self.filtrar_por_tipo(registros, params["tipo"], params["fecha_inicio_str"], params["fecha_fin_str"])
            if not registros:
                res = (False, None, 0, None, None, "No se encontraron facturas en el rango de fechas especificado.", None)
                self.root.after(0, lambda r=res: self._al_finalizar_generar(r))
                return
            df = pd.DataFrame(registros)
            if params["formato_resumido"]:
                df = df[["FECHA DE LA FACTURA", "N° FACTURA", "COMPAÑÍA"]].copy()
                df = df.rename(columns={"FECHA DE LA FACTURA": "FECHA", "N° FACTURA": "COTU", "COMPAÑÍA": "ASEGURADORA"})
                columnas_orden = ["FECHA", "COTU", "ASEGURADORA"]
            else:
                columnas_orden = ["FECHA DE LA FACTURA", "MES", "N° FACTURA"]
            by_cols = [c for c in columnas_orden if c in df.columns]
            if by_cols:
                df.sort_values(by=by_cols, inplace=True)
            tipo, nombre_anio = params["tipo"], params["nombre_anio"]
            fecha_inicio, fecha_fin = params["fecha_inicio"], params["fecha_fin"]
            if tipo == "Año":
                nombre_archivo = f"cotus_{nombre_anio.lower().replace(' ', '_')}.xlsx"
            elif tipo == "Día":
                nombre_archivo = f"cotus_dia_{fecha_inicio.strftime('%Y%m%d')}.xlsx"
            elif tipo == "Semana":
                nombre_archivo = f"cotus_semana_{fecha_inicio.strftime('%Y%m%d')}_{fecha_fin.strftime('%Y%m%d')}.xlsx"
            else:
                nombre_archivo = f"cotus_mes_{fecha_inicio.strftime('%Y%m%d')}_{fecha_fin.strftime('%Y%m%d')}.xlsx"
            ruta_salida = os.path.join(params["ruta_base"], nombre_archivo)
            carpeta_salida = os.path.dirname(ruta_salida)
            try:
                test_file = os.path.join(carpeta_salida, ".permiso_escritura_tmp")
                with open(test_file, "w") as f:
                    f.write("")
                os.remove(test_file)
            except (OSError, PermissionError):
                res = (False, None, 0, tipo, None, "No hay permisos de escritura en la carpeta seleccionada.", None)
                self.root.after(0, lambda r=res: self._al_finalizar_generar(r))
                return
            try:
                import openpyxl  # noqa: F401
                engine, usar_openpyxl = 'openpyxl', True
            except ImportError:
                try:
                    import xlsxwriter  # noqa: F401
                    engine, usar_openpyxl = 'xlsxwriter', False
                except ImportError:
                    engine, usar_openpyxl = None, False
                    warning_msg = "openpyxl no está instalado. Intentando con engine por defecto.\nPara mejores resultados, instala: pip install openpyxl"
            writer = None
            try:
                writer = pd.ExcelWriter(ruta_salida, engine=engine) if engine else pd.ExcelWriter(ruta_salida)
                nombre_hoja = {"Año": "NOVEDADES ANUALES", "Mes": "NOVEDADES MENSUALES", "Semana": "NOVEDADES SEMANALES", "Día": "NOVEDADES DIARIAS"}[tipo]
                df.to_excel(writer, index=False, sheet_name=nombre_hoja)
                if usar_openpyxl:
                    hoja = writer.sheets[nombre_hoja]
                    hoja.auto_filter.ref = hoja.dimensions
                    for column in hoja.columns:
                        max_length = 0
                        for cell in column:
                            try:
                                n = len(str(cell.value))
                                if n > max_length:
                                    max_length = n
                            except (TypeError, AttributeError):
                                pass
                        hoja.column_dimensions[column[0].column_letter].width = min(max_length + 2, 50)
            except Exception as e:
                if writer is not None:
                    try:
                        writer.close()
                    except Exception:
                        pass
                ruta_csv = ruta_salida.replace('.xlsx', '.csv')
                df.to_csv(ruta_csv, index=False, encoding='utf-8-sig')
                err_text = f"No se pudo generar Excel. Se generó CSV en su lugar:\n{ruta_csv}\n\nError original: {str(e)}\n\nPara generar Excel, instala: pip install openpyxl"
                _log.exception("Error al generar reporte")
                res = (False, ruta_csv, len(df), tipo, os.path.basename(ruta_csv), err_text, warning_msg)
                self.root.after(0, lambda r=res: self._al_finalizar_generar(r))
                return
            finally:
                if writer is not None:
                    try:
                        writer.close()
                    except Exception:
                        pass
            ok, total = True, len(df)
            _log.info("Reporte generado: %s (%s facturas)", ruta_salida, total)
        except Exception as e:
            error_msg = str(e)
            _log.exception("Error al generar reporte")
        res = (ok, ruta_salida, total, tipo, nombre_archivo, error_msg, warning_msg)
        self.root.after(0, lambda r=res: self._al_finalizar_generar(r))

    def _al_finalizar_generar(self, res):
        """Callback en hilo principal tras terminar _ejecutar_generar."""
        self.progress.stop()
        self.btn_generar.config(state='normal')
        ok, ruta_salida, total, tipo, nombre_archivo, error_msg, warning_msg = res
        if warning_msg:
            messagebox.showwarning("Advertencia", warning_msg)
        if ok and ruta_salida:
            self.guardar_historial(tipo, nombre_archivo, ruta_salida, total)
            self._guardar_config()
            self.actualizar_status("Reporte generado exitosamente", "green")
            self._mostrar_exito_abrir_carpeta(ruta_salida, total)
        elif error_msg:
            self.actualizar_status(error_msg[:50] + "…" if len(error_msg) > 50 else error_msg, "red")
            messagebox.showerror("Error", error_msg)

    def generar_reporte(self):
        """Genera el reporte según el tipo seleccionado (en segundo plano para no bloquear la UI)."""
        if not self.ruta_base.get():
            messagebox.showerror("Error", "Por favor, selecciona la carpeta del año")
            return
        tipo = self.tipo_reporte.get()
        fecha_inicio, fecha_fin = None, None
        if tipo in ["Mes", "Semana", "Día"]:
            if not self.fecha_inicio.get():
                messagebox.showerror("Error", "Por favor, ingresa la fecha de inicio")
                return
            fecha_inicio = self.validar_fecha(self.fecha_inicio.get())
            if not fecha_inicio:
                messagebox.showerror("Error", "Formato de fecha inválido. Usa DD/MM/YYYY")
                return
            if tipo != "Día":
                if not self.fecha_fin.get():
                    messagebox.showerror("Error", "Por favor, ingresa la fecha de fin")
                    return
                fecha_fin = self.validar_fecha(self.fecha_fin.get())
                if not fecha_fin:
                    messagebox.showerror("Error", "Formato de fecha de fin inválido. Usa DD/MM/YYYY")
                    return
                if fecha_fin < fecha_inicio:
                    messagebox.showerror("Error", "La fecha 'Hasta' debe ser posterior o igual a la fecha 'Desde'.")
                    return
            else:
                fecha_fin = fecha_inicio
        params = {
            "ruta_base": self.ruta_base.get(),
            "tipo": tipo,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "fecha_inicio_str": self.fecha_inicio.get(),
            "fecha_fin_str": self.fecha_fin.get(),
            "formato_resumido": self.formato_resumido.get(),
            "nombre_anio": os.path.basename(self.ruta_base.get().rstrip(os.sep)),
        }
        self.progress.start()
        self.btn_generar.config(state='disabled')
        self.actualizar_status("Extrayendo facturas...", "blue")
        threading.Thread(target=self._ejecutar_generar, args=(params,), daemon=True).start()


def main():
    _configurar_logging()
    root = tk.Tk()
    GeneradorFacturasCOTU(root)
    root.mainloop()


if __name__ == "__main__":
    main()
