# Changelog

## [0.1.9] - 2026-07-09

- Añadido el agente de ejemplo `update-sentinel` para verificar actualizaciones.

## [0.1.8] - 2026-07-09

- El actualizador usa únicamente HTTPS y el manifiesto web configurado.
- Eliminadas la autenticación y las referencias GitHub del cliente de la extensión.

## [0.1.7] - 2026-07-09

- Instalación automática de agentes y skills al activar, instalar o actualizar la extensión.
- Añadida la opción `devinGlobalCustomizations.installOnActivation` para desactivar este comportamiento.

## [0.1.6] - 2026-07-09

- Añadido el agente experimental `random-orbit` para probar la actualización.

## [0.1.5] - 2026-07-09

- Sustituida la consulta de GitHub Releases por un manifiesto estático de GitHub Pages.
- Añadida descarga del VSIX desde la `downloadUrl` del manifiesto.
- Añadido workflow para publicar `updates/latest.json` y el VSIX en GitHub Pages.

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
