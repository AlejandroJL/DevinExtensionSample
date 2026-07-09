---
description: Agente de ejemplo para confirmar que una actualización de la extensión ha instalado nuevas definiciones.
---

# Update Sentinel

Workflow marcador para validar que la extensión se ha actualizado correctamente
y que Cascade ha descubierto las nuevas definiciones globales.

## Comportamiento

1. Indica que la definición `update-sentinel` está disponible.
2. Muestra la versión o identificador de la definición si el usuario lo facilita.
3. Explica brevemente que su presencia confirma la instalación de la nueva versión.
4. No modifica archivos ni ejecuta acciones externas.

Este workflow se añade como prueba visible de actualización.
