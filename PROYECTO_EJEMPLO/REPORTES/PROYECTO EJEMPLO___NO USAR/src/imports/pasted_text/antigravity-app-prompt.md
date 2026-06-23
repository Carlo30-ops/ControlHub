Perfecto, ya veo la estructura exacta de tu Excel. Aquí tienes el prompt completo **en español** con la estructura integrada:

---

**PROMPT PARA FIGMA AI — APP "ANTIGRAVITY"**

---

```
Diseña una aplicación web de escritorio llamada "ANTIGRAVITY" — una herramienta 
de escaneo diario de facturas y generación de reportes para facturación de 
aseguradoras colombianas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARCA Y ESTILO VISUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nombre: ANTIGRAVITY
- Tema oscuro, fondo azul marino profundo (#0A0F1E)
- Color principal: azul eléctrico (#3B82F6) y cian neón (#06B6D4)
- Color secundario: púrpura suave (#8B5CF6)
- Estética SaaS futurista y limpia — inspirada en Notion, Linear y dashboards fintech
- Tipografía: Inter o Geist, encabezados en negrita, alto contraste
- Tarjetas con efecto glassmorfismo y bordes translúcidos
- Bordes redondeados (radio 12–16px)
- Logotipo: una flecha estilizada hacia arriba rompiendo una barra horizontal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PANTALLAS A DISEÑAR (5 pantallas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PANTALLA 1 — DASHBOARD (Inicio)
- Encabezado con logo ANTIGRAVITY, fecha actual y avatar de usuario
- Tarjetas de resumen: "Facturas escaneadas hoy", "Aseguradoras activas", 
  "Pendientes", "Reportes generados"
- Feed central con carpetas escaneadas recientemente
- Botón de acción principal: "Escanear carpeta" (azul eléctrico)
- Barra lateral izquierda con íconos: Dashboard, Escanear, Reportes, 
  Aseguradoras, Configuración

---

PANTALLA 2 — ESCÁNER (Selección de carpeta)
- Ruta de carpeta en migas de pan:
  C:\Users\factu\OneDrive\Desktop\FACTURACION\2026\04 ABRIL\13 ABRIL\[ASEGURADORA]
- Panel izquierdo: árbol de carpetas con las aseguradoras seleccionables
- Lista de aseguradoras con etiquetas de color:
  ALFA, ALLIANZ, AURORA, AXXA COLPATRIA, BOLIVAR, CENFAR, COLMENA, COLSANITAS, 
  EQUIDAD, ESTADO, ESTADO SOAT, HDII WTA LATAM S.A.S, 
  LIBERTY (HDI SEGUROS COLOMBIA), MAPFRE, MEDIPORT, MUNDIAL, POSITIVA, 
  PREVISORA, SOAT SURA, SOLIDARIA, SURA
- Cada aseguradora: tarjeta con checkbox, nombre y contador de facturas
- Botón "Escanear seleccionadas" con barra de progreso animada
- Panel derecho: vista previa en vivo de los documentos detectados

---

PANTALLA 3 — RESULTADOS DEL ESCANEO
- Vista dividida: previsualización del documento a la izquierda, 
  datos extraídos a la derecha
- Campos extraídos automáticamente:
  • FECHA DE LA FACTURA
  • N° FACTURA (ejemplo: COTU78756)
  • COMPAÑÍA (con menú desplegable de aseguradoras, igual al Excel)
  • FECHA DE REFACTURACIÓN (campo editable, puede quedar vacío)
  • COMPAÑÍA REFACTURADA (campo editable, puede quedar vacío)
  • N° DE REFACTURA (campo editable, puede quedar vacío)
  • ESTADO (desplegable con opciones: ENTREGADA, PENDIENTE, DEVUELTA)
  • OBSERVACIÓN DE FACTURACIÓN (texto libre, default: "SIN NOVEDAD")
- Tabla inferior con todas las facturas del día, ordenable por columna
- Botón prominente: "Copiar al Excel" en la parte superior derecha

---

PANTALLA 4 — REPORTE DIARIO (Vista principal)
- Selector de fecha mostrando el día actual
- Tabla de reporte con la estructura EXACTA del Excel de actividades diarias:

  ┌─────────────────┬──────────────┬───────────────┬──────────────────────┬──────────────────────┬────────────────┬───────────┬──────────────────────────────┐
  │FECHA DE LA      │ N° FACTURA   │ COMPAÑÍA      │ FECHA DE             │ COMPAÑÍA             │ N° DE          │ ESTADO    │ OBSERVACION DE               │
  │FACTURA          │              │               │ REFACTURACIÓN        │ REFACTURADA          │ REFACTURA      │           │ FACTURACIÓN                  │
  ├─────────────────┼──────────────┼───────────────┼──────────────────────┼──────────────────────┼────────────────┼───────────┼──────────────────────────────┤
  │ 13/04/2026      │ COTU78756    │ BOLIVAR  ▼   │                      │                      │                │ENTREGADA ▼│ SIN NOVEDAD                  │
  └─────────────────┴──────────────┴───────────────┴──────────────────────┴──────────────────────┴────────────────┴───────────┴──────────────────────────────┘

- El nombre de cada compañía debe mostrarse en su color único distintivo 
  (igual que en el Excel: SOLIDARIA en dorado, POSITIVA en rojo, AURORA en naranja, etc.)
- Estado "ENTREGADA" en color verde (#22C55E)
- Botón grande: "📋 COPIAR REPORTE" — copia el contenido listo para pegar en Excel
- Botón secundario: "Exportar PDF"
- Panel de previsualización: muestra exactamente cómo quedará en Excel

---

PANTALLA 5 — CONFIGURACIÓN / ASEGURADORAS
- Lista de las 21 aseguradoras con toggle para activar/desactivar
- Campo editable de ruta de carpeta por aseguradora
- Color asignado a cada aseguradora (editable con color picker)
- Preferencias de notificaciones
- Modo de escaneo: manual o automático programado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENTES A INCLUIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Barra de navegación superior con logo ANTIGRAVITY
- Barra lateral colapsable (240px)
- Componente de etiqueta de estado: ENTREGADA (verde), PENDIENTE (amarillo), 
  DEVUELTA (rojo)
- Tarjeta de aseguradora con logo placeholder, nombre en color y contador
- Componente de migas de pan para la ruta de carpeta
- Tabla de datos con orden, selección de filas y menús desplegables
- Botón primario (degradado azul eléctrico), botón secundario (contorno)
- Animación de progreso de escaneo (barra y spinner)
- Estado vacío: ilustración de "No se encontraron documentos"
- Encabezado de sección: "NOVEDADES FACTURACIÓN" (igual al Excel)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISEÑO Y GRILLA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Ancho escritorio: 1440px
- Barra lateral fija: 240px
- Contenido principal: fluido
- Sistema de grilla de 8px
- Espaciado generoso dentro de tarjetas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONO Y PROPÓSITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Profesional, rápido y confiable. El usuario es un especialista en facturación 
que procesa facturas de aseguradoras colombianas todos los días. La app debe 
sentirse poderosa pero simple — como si le ahorrara 2 horas de trabajo diario. 
El reporte generado debe poder pegarse directamente en el Excel de 
"NOVEDADES FACTURACIÓN" sin edición manual.
```

---

**Puntos clave que incorporé de tu Excel:**

| Columna Excel | Cómo la maneja ANTIGRAVITY |
|---|---|
| FECHA DE LA FACTURA | Extraída automáticamente del documento |
| N° FACTURA | Leído del nombre del archivo (ej. COTU78756) |
| COMPAÑÍA | Detectada por la carpeta de origen + dropdown |
| FECHA DE REFACTURACIÓN | Campo editable (vacío por defecto) |
| COMPAÑÍA REFACTURADA | Campo editable (vacío por defecto) |
| N° DE REFACTURA | Campo editable (vacío por defecto) |
| ESTADO | Dropdown: ENTREGADA / PENDIENTE / DEVUELTA |
| OBSERVACIÓN | Texto libre (default: "SIN NOVEDAD") |

¿Quieres que ahora construya la app funcional real que escanee esas carpetas y genere el reporte listo para pegar?