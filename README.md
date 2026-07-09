# Devin Global Customizations

Plugin de Agent Customizations para Devin Desktop y VS Code. Incluye agentes y
skills reutilizables que se instalan en el perfil del usuario y, por tanto,
pueden estar disponibles en cualquier ventana o espacio de trabajo del IDE.

## Qué contiene

- `agents/`: agentes personalizados (`*.agent.md`).
- `skills/`: skills compatibles con el estándar Agent Skills (`SKILL.md`).
- `.devin/agents/`: agentes nativos de Devin, con formato
  `.devin/agents/<nombre>/AGENT.md`.
- `.devin/skills/`: skills nativas de Devin, con formato
  `.devin/skills/<nombre>/SKILL.md`.
- `plugin.json`: manifiesto del plugin y punto de entrada para la instalación
  desde Git.
- `scripts/validate.mjs`: validación local del manifiesto y de los recursos.

## Instalación en Devin Desktop / VS Code

### Opción recomendada: Agent Plugin desde Git

1. Abre la paleta de comandos.
2. Ejecuta `Chat: Install Plugin From Source`.
3. Introduce la URL Git de este repositorio.
4. Activa el plugin desde la vista de plugins si aparece desactivado.

La instalación desde Git registra el plugin en el perfil del usuario, no en un
workspace concreto. Para que aparezca, la distribución de Devin Desktop debe
tener habilitados los Agent Plugins (`chat.plugins.enabled`).

### Opción alternativa: extensión VSIX

El repositorio también incluye un manifiesto de extensión VS Code en
`package.json`, con los puntos de contribución `chatAgents` y `chatSkills`.
Puede empaquetarse con `@vscode/vsce` e instalarse como VSIX. Esta alternativa
es útil para entornos que soportan extensiones VS Code pero todavía no muestran
Agent Plugins; las actualizaciones deberán distribuirse como nuevas versiones
de la extensión.

Después de instalar el VSIX, usa la paleta de comandos y ejecuta
`Devin: Install or Update Agents and Skills Globally`, o pulsa el botón
`Devin Global` de la barra de estado. La extensión copiará `.devin/agents/` y
`.devin/skills/` a `~/.config/devin/agents/` y `~/.config/devin/skills/`.
En Windows usa `%APPDATA%/devin/agents/` y `%APPDATA%/devin/skills/`.

Como alternativa para probar una copia local, configura la ruta del repositorio
en `chat.pluginLocations`:

```json
{
  "chat.pluginLocations": {
    "/ruta/absoluta/a/Devin Extension": true
  }
}
```

## Actualizaciones

Cada cambio publicado debe aumentar `version` en `plugin.json`. El IDE puede
buscar actualizaciones automáticamente según la configuración de actualización
de extensiones o manualmente con `Extensions: Check for Extension Updates`.

## Desarrollo

No requiere dependencias de npm para validar el contenido localmente:

```bash
node scripts/validate.mjs
```

Si necesitas generar un VSIX, instala `@vscode/vsce` en tu entorno y ejecuta
`vsce package` desde la raíz del repositorio.

Al añadir un skill, el nombre del directorio debe coincidir exactamente con el
campo `name` de su frontmatter. Los nombres de plugins y skills deben usar
minúsculas, números y guiones.

## Alcance de Devin

Devin puede descubrir las definiciones del proyecto bajo `.devin/agents/` y
`.devin/skills/`. La instalación global del CLI usa las rutas de usuario
`~/.config/devin/agents/` y `~/.config/devin/skills/`; esas rutas no se escriben
desde el repositorio. Para disponer de los recursos entre ventanas, instala el
Agent Plugin en el perfil del IDE.

## Licencia

MIT. Consulta [LICENSE](LICENSE).
