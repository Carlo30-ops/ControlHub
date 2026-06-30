# RULES

1. Toda documentación nueva va en CONTEXT.md, no en archivos markdown separados.
2. No crear archivos `CHANGELOG_*`, `ARCHITECTURE_*`, `README_*`, `TESTING_*`, `EXECUTIVE_SUMMARY_*` por feature individual.
3. El build debe pasar limpio antes de declarar cualquier issue como resuelto.
4. No agregar dependencias sin verificar que no estén ya en package.json.
5. Antes de declarar un fix de optimización de rendimiento como funcional, confirmar con logs reales en consola que el camino optimizado se ejecuta — un fallback silencioso a comportamiento anterior puede pasar desapercibido si solo se valida que "no rompió nada", sin confirmar que la mejora realmente se activó.
6. Fuente de verdad del proyecto: CONTEXT.md y package.json. El README.md es solo onboarding público.
7. Cada sesión de trabajo cierra con una sola actualización a CONTEXT.md, no con múltiples archivos de resumen.
8. Configuración de usuario (`terapiasDir`, `tesseractPath`, rutas Terapias, columnas, etc.) persiste solo en `settings.json` vía `db:saveSettings`. `electron-store` reserva flags de migración one-time.
9. La modularización de PDFTools se documenta en CONTEXT.md y los hooks/componentes se crean bajo `src/app/pages/PDFTools/hooks/` y `src/app/pages/PDFTools/components/`.
10. Separar la lógica de negocio de la UI: la lógica debe vivir en servicios, hooks o utilidades; los componentes páginas solo deben renderizar y orquestar.
11. Usar el sistema de logging centralizado (`electron/logger.ts` para main process, `src/app/utils/logger.ts` para renderer) en lugar de `console.log` disperso.
12. Usar el sistema de manejo de errores centralizado (`src/app/utils/errorHandler.ts`) con tipos de error personalizados (`AppError`, `ErrorType`) en lugar de try/catch sin tipado.
13. Usar constantes centralizadas (`src/app/constants/`) para colores, formatos de fecha, paginación y umbrales de moneda en lugar de valores hardcodeados.
14. Usar formateadores centralizados (`src/app/utils/formatters.ts`) para moneda y fechas en lugar de funciones duplicadas en componentes.
15. La modularización de localScanner se documenta en CONTEXT.md y los submódulos se crean bajo `src/app/utils/localScanner/` (cache.ts, extractors.ts, invoiceIdentifier.ts, pathResolver.ts).

## Reglas de organización y modularización

16. **Modularización de sidecars Python:** Los sidecars Python monolíticos deben modularizarse cuando superen ~500 líneas. Extraer funciones a archivos individuales en subdirectorios temáticos (ej: `engines/`) y utilidades compartidas a archivos de utilidades (ej: `pdf_utils.py`).
17. **Dependencias de módulos Python:** Al crear nuevos módulos Python, siempre agregar `sys.path.insert(0, ...)` al inicio del archivo para permitir importaciones cuando el sidecar se ejecuta directamente. Las utilidades compartidas deben importarse desde un archivo centralizado (ej: `pdf_utils.py`).
18. **Validación de imports Python:** Antes de declarar una migración de motores Python como completada, verificar que todas las importaciones funcionan correctamente. Un error de importación en un módulo causará que todos los motores se seteen a `None` y el router reportará "motor no disponible".
19. **Reporte de progreso en sidecars:** Los motores Python deben reportar progreso vía stderr con formato estandarizado (ej: `COMPRESS_PROGRESS:start|{level}|{size}`) para que el frontend pueda mostrar indicadores visuales al usuario.
20. **Validación de inputs en sidecars:** Todo motor Python debe validar inputs (existencia de archivo, directorio de salida, extensiones válidas) antes de procesar. Retornar error descriptivo si la validación falla.
21. **Validación de outputs en sidecars:** Todo motor Python debe validar outputs (existencia de archivo generado, tamaño mínimo) antes de retornar éxito. Retornar error si el output es inválido.
22. **Manejo de recursos en sidecars:** Todo motor Python debe usar bloques `try/finally` para asegurar limpieza de recursos (cerrar documentos, eliminar archivos temporales, desinicializar COM) incluso si ocurre un error.
23. **Frontend validation:** Las herramientas del frontend (`src/app/pages/PDFTools/tools/*.ts`) deben validar inputs antes de enviar al backend. Esto incluye validación de parámetros, extensiones de archivo y rutas.
24. **Correlación frontend-backend:** Al agregar un nuevo parámetro en el frontend, verificar que el backend lo espera con el mismo nombre de clave. Los nombres de parámetros deben ser consistentes entre frontend y backend.
25. **Fallbacks en motores:** Los motores Python deben implementar fallbacks cuando dependen de herramientas externas (ej: Ghostscript, Tesseract). Si la herramienta principal no está disponible, intentar con alternativas y reportar warning al usuario.
26. **Eliminación de código duplicado:** Al modularizar, eliminar código duplicado del archivo original. No dejar funciones huérfanas o código muerto en el archivo principal después de la migración.
27. **Actualización de dispatcher:** Al migrar funciones a módulos separados, actualizar el dispatcher en el archivo principal para importar y llamar a las funciones migradas. Usar fallbacks con mensajes de error claros si la importación falla.
28. **Bytecode Python:** Los archivos Python del proyecto se compilarán automáticamente a bytecode y se guardarán en `__pycache__/` cuando se importen. No es necesario gestionar manualmente este directorio.
