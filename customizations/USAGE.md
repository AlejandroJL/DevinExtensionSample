# Usage

## Devin agents

Los agentes se registran en Devin a partir de `customizations/agents/` y se
instalan globalmente en el perfil de Devin. Puedes seleccionarlos desde el
selector de agentes de Devin Desktop o desde las contribuciones de chat del
IDE.

## Cascade workflows

Los agentes se convierten en workflows globales de Cascade. Después de
sincronizar la extensión, se invocan escribiendo `/nombre-del-agente` en el
chat de Cascade.

## Skills

Las skills se comparten entre Devin y Cascade. Cascade puede invocarlas con
`@nombre-de-skill` o usarlas automáticamente cuando la descripción coincide
con la tarea.

## Sincronización y actualizaciones

La extensión sincroniza las definiciones automáticamente al instalarse o
actualizarse. También puedes ejecutar `Devin/Cascade: Install or Update Global
Customizations` manualmente. Si Cascade no muestra una definición nueva,
recarga el IDE o abre una nueva conversación.
