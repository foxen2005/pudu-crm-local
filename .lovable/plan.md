

## Problema

`src/main.tsx` importa `./index.css` pero no importa `./globals.css`, que es donde vive la configuración de Tailwind v4 (`@import "tailwindcss"`, `@theme`, utilidades, etc.).

Sin ese import, Tailwind no se carga en la app.

## Configuracion actual (correcta)

- `tailwindcss` v4.2.2 y `@tailwindcss/postcss` v4.2.2 instalados
- `postcss.config.js` usa `@tailwindcss/postcss` (correcto para v4)
- `globals.css` tiene `@import "tailwindcss"` y el `@theme` con la paleta Obsidian Orchid
- **No existe** `tailwind.config.js` (correcto para v4)

## Plan

### Paso 1: Importar globals.css en main.tsx

Agregar `import './globals.css'` en `src/main.tsx` para que Tailwind se cargue:

```tsx
import './index.css'
import './globals.css'  // <-- agregar esta línea
```

### Paso 2: Verificar que build:dev existe

Asegurar que `package.json` tenga el script `build:dev`:

```json
"build:dev": "vite build"
```

---

Eso es todo. La configuracion de Tailwind v4 ya esta bien, solo falta el import.

