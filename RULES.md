# RULES

1. Toda documentación nueva va en CONTEXT.md, no en archivos markdown separados.
2. No crear archivos `CHANGELOG_*`, `ARCHITECTURE_*`, `README_*`, `TESTING_*`, `EXECUTIVE_SUMMARY_*` por feature individual.
3. El build debe pasar limpio antes de declarar cualquier issue como resuelto.
4. No agregar dependencias sin verificar que no estén ya en package.json.
5. `html2canvas` aparece en el bundle actual pero fue marcado como eliminado en P16 — verificar y eliminar si sigue sin usarse.
6. Fuente de verdad del proyecto: CONTEXT.md y package.json. El README.md es solo onboarding público.
7. Cada sesión de trabajo cierra con una sola actualización a CONTEXT.md, no con múltiples archivos de resumen.
