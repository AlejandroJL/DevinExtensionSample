---
name: project-discovery
description: Explora un repositorio de forma sistemática y crea un mapa técnico fiable antes de implementar cambios.
argument-hint: <area o funcionalidad a investigar>
user-invocable: true
disable-model-invocation: false
---

# Project Discovery

Usa esta skill cuando necesites entender una parte de un repositorio antes de
editarla.

## Investigación

1. Define el área o funcionalidad a investigar a partir de `$ARGUMENTS`.
2. Examina la estructura del repositorio, instrucciones locales y archivos de
   configuración relevantes.
3. Busca símbolos, rutas, comandos y referencias relacionadas.
4. Sigue el flujo desde los puntos de entrada hasta sus consumidores.
5. Distingue hechos observados de inferencias y señala información faltante.

## Resultado

Entrega un resumen breve que incluya:

- Propósito y puntos de entrada.
- Archivos relevantes y responsabilidad de cada uno.
- Flujo de datos o control.
- Dependencias y riesgos.
- Siguientes pasos recomendados.

No edites archivos durante la fase de descubrimiento.
