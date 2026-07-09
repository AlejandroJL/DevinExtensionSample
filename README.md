# Devin Global Customizations

Plugin de Agent Customizations para Devin Desktop y VS Code. Incluye agentes y
skills reutilizables que se instalan en el perfil del usuario y, por tanto,
pueden estar disponibles en cualquier ventana o espacio de trabajo del IDE.

## Qué contiene

- `agents/`: agentes personalizados (`*.agent.md`).
- `skills/`: skills compatibles con el estándar Agent Skills (`SKILL.md`).
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

Devin descubre skills guardadas en repositorios conectados mediante
`.agents/skills/`, pero ese mecanismo es distinto del alcance global del plugin
instalado en el IDE. Este repositorio usa el formato de Agent Plugin para que
los agentes y skills se instalen en el perfil del usuario y puedan compartirse
entre ventanas.

## Licencia

MIT. Consulta [LICENSE](LICENSE).
