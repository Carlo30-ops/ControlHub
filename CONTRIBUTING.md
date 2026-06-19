# Contribuir a ControlHub

Gracias por tu interés en mejorar ControlHub. Este proyecto es una app Electron + React orientada a **Windows**.

## Antes de empezar

1. Lee [CONTEXT.md](./CONTEXT.md) para entender arquitectura, IPC y decisiones ya tomadas.
2. Revisa [BUSINESS_LOGIC_SPEC.md](./BUSINESS_LOGIC_SPEC.md) si tocas el escáner COTU.
3. No reintroduzcas patrones descartados (ver sección "Lo que NO hacer" en CONTEXT.md).

## Entorno de desarrollo

```bash
npm install
npm run dev
```

Verifica cambios con:

```bash
npm run build
npm run test
```

Para sidecar Python:

```bash
pytest electron/sidecar/tests/
```

## Convenciones

| Ámbito | Patrón |
|--------|--------|
| IPC | `namespace:action` (ej. `fs:parsePdf`, `pdf:merge`) |
| Sidecar cmd | `{ "cmd": "snake_case", "data": {...} }` |
| Tipos compartidos | `src/shared/types.ts` |
| Páginas React | PascalCase en `src/app/pages/` |

## Pull requests

1. Describe el **por qué** del cambio, no solo el qué.
2. Incluye pasos de prueba manual si afecta UI o sidecars.
3. Ejecuta `npm run build` y confirma que compila sin errores TypeScript.
4. No incluyas `python-embed/`, `node_modules/`, PDFs de muestra ni artefactos de build.

## Reportar bugs

Incluye: versión (`package.json`), módulo afectado, pasos para reproducir y logs de consola o sidecar (stderr).
