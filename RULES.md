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
