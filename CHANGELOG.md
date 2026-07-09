# Changelog

## [0.1.4] - 2026-07-09

- Añadida comprobación manual y automática de actualizaciones desde GitHub Releases.
- Añadida descarga verificada por SHA-256 e instalación del VSIX desde la extensión.
- Añadida autenticación mediante GitHub Authentication de VS Code o token protegido.
- No se requiere ni se ejecuta `gh` como fallback.

## [0.1.3] - 2026-07-09

- Añadido el comando y botón `Devin: Install or Update Agents and Skills Globally`.
- La extensión instala las definiciones en `~/.config/devin/agents` y
  `~/.config/devin/skills`.

## [0.1.2] - 2026-07-09

- Incluida la carpeta `.devin/` dentro del empaquetado VSIX.

## [0.1.1] - 2026-07-09

- Añadida la estructura nativa `.devin/agents/` y `.devin/skills/` para Devin.
- Añadida validación de las definiciones espejo de Devin.

## [0.1.0] - 2026-07-09

- Añadido el manifiesto inicial del Agent Plugin.
- Añadidos los agentes `global-planner` y `global-reviewer`.
- Añadidos los skills `project-discovery` y `safe-release`.
- Añadida validación local del contenido del plugin.
