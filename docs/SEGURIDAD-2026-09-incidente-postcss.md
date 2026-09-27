# Incidente de seguridad: malware en `postcss.config.js`

**Detectado:** 24-09-2026 en EinaShopV (copia de Manojitos) · **Estado en Manojitos:** eliminado el 27-09-2026 (estuvo desde el commit inicial hasta este arreglo).

> ⚠️ **27-09-2026 — REINFECCIÓN.** El archivo infectado volvió en `121bbb1` (PR #39, commit hecho
> desde un equipo local) y estuvo en `main` hasta este arreglo: **todas las compilaciones de Vercel
> desde el PR #39 ejecutaron el malware**. Manojitos nunca se limpió (32 KB en su `main`).
> Se restauró el archivo limpio y se agregó un **candado** (`scripts/verificar-configs.mjs`, que npm
> corre solo en `predev` y `prebuild`): si el archivo vuelve, `npm run dev`/`build` se detienen
> **antes** de que Vite lo cargue, en tu computadora y en Vercel.
> La reinfección indica que el equipo desde el que se hizo el commit **sigue comprometido** o
> tenía la copia vieja: aplicar ya la sección "Qué hacer" en ese equipo.

## Qué era
`postcss.config.js` traía, desde el **commit inicial** (la copia del proyecto Manojitos), unos
32 KB de JavaScript ofuscado escondidos al final de la línea `};`, detrás de cientos de
tabuladores (en un editor se ve un archivo normal de 11 líneas).

Vite carga ese archivo en **cada `npm run dev` y `npm run build`** (en tu computadora y en
Vercel). Al cargarse:

1. Consulta transacciones de una dirección de Ethereum mediante nodos y APIs públicas
   (Blockscout, drpc, publicnode…) para obtener un payload comprimido (técnica
   *EtherHiding*: el código real vive en la blockchain y no se puede borrar).
2. Lanza ese payload en segundo plano con `child_process.spawn('node', …)`; el proceso sigue
   vivo aunque cierres la terminal.
3. El proceso lanzado se comunica con `166.88.134.75` (puertos 80 y 443).

Este patrón es típico de campañas que roban contraseñas guardadas en el navegador, tokens
(GitHub, npm, nube), llaves SSH y billeteras de criptomonedas.

## Indicadores (IOC)
- Archivo: `postcss.config.js` con más de 1 KB o una línea muy larga.
- Cadena: `global.i = 'A8-1359'` / `global['_V']='A8-1359'`.
- Proceso: `node -e global['_V']='A8-1359';…` corriendo sin terminal.
- Red: conexiones a `166.88.134.75`.

## Qué hacer (en cada computadora que haya corrido `npm run dev` o `npm run build` de EinaShopV o Manojitos)
1. **Buscar y cerrar el proceso**: en macOS/Linux `ps aux | grep "A8-1359"`; en Windows,
   Administrador de tareas → Detalles → `node.exe` sin ventana. Cerrarlo.
2. **Revisar Manojitos y cualquier otro repo copiado de la misma fuente**:
   `grep -rl "A8-1359" .` y abrir `postcss.config.js`, `tailwind.config.*`, `vite.config.*`,
   `eslint.config.*` buscando líneas enormes.
3. **Rotar credenciales** desde un equipo limpio: GitHub (tokens y sesiones), Vercel, Supabase
   (tokens de acceso; la *service role key* si estuvo en algún `.env` local), npm, correo,
   y contraseñas guardadas en el navegador. Mover fondos de billeteras cripto si las hay.
4. Pasar un antivirus/EDR completo; si hay dudas, reinstalar el sistema.
5. En Vercel, el build corría el mismo código: revisar variables de entorno sensibles del
   proyecto y regenerarlas si alguna no es pública.

## Cómo evitar que vuelva a pasar
- **Candado automático**: `scripts/verificar-configs.mjs` (en `predev`/`prebuild`) revisa `postcss`, `tailwind`, `vite`, `eslint`, `vitest` e `index.html`: tamaño, líneas de más de 1000 caracteres y firmas del malware. Si falla, no se compila. En Vercel, el *Build Command* debe seguir siendo `npm run build` (no `vite build` directo).
- No copiar proyectos desde fuentes no verificadas; revisar los archivos de configuración
  (`*.config.js`) con `wc -c` y `awk 'length > 500'` antes de correr `npm install`/`dev`.
- La skill `.claude/skills/diseno` y las auditorías incluyen ahora este chequeo.
