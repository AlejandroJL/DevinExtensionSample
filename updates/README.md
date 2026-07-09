# Update resources

Esta carpeta contiene los recursos publicados por GitHub Pages para actualizar
la extensión:

- `latest.json`: versión disponible, URL del VSIX y SHA-256.
- `index.html`: página informativa del endpoint de actualización.

El workflow `.github/workflows/pages.yml` genera y publica el `latest.json` y el
VSIX más reciente en esta misma ruta. El fichero versionado sirve como
referencia local para validación y desarrollo.
