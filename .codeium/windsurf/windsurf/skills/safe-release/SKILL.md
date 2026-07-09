---
name: safe-release
description: Prepara y verifica una publicación versionada sin ejecutar operaciones de Git destructivas ni publicar sin confirmación.
argument-hint: <versión o alcance de la publicación>
triggers:
  - user
---

# Safe Release

Usa esta skill únicamente cuando el usuario pida preparar una publicación o
release. `$ARGUMENTS` contiene la versión o el alcance indicado.

## Preparación

1. Lee `plugin.json`, `CHANGELOG.md` y el estado actual del repositorio.
2. Comprueba que la versión sea semántica y que coincida con la entrada más
   reciente del changelog.
3. Ejecuta las validaciones del proyecto y revisa el diff completo.
4. Busca rutas rotas, secretos, archivos generados y cambios no relacionados.
5. Resume los checks realizados y cualquier bloqueo.

## Seguridad

- No hagas `push`, publiques releases ni crees tags sin una petición explícita.
- No uses `reset --hard`, `checkout --` ni borres archivos para limpiar el árbol.
- Si falta una decisión de versión, detente y solicita confirmación.

## Resultado

Devuelve una checklist de release con estado `OK`, `FALLO` o `PENDIENTE`, junto
con los comandos que el mantenedor debe ejecutar manualmente para publicar.
