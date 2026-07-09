import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Falta ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

let manifest;
try {
  manifest = JSON.parse(read('plugin.json'));
} catch (error) {
  errors.push(`plugin.json no es JSON válido: ${error.message}`);
}

let extensionManifest;
try {
  extensionManifest = JSON.parse(read('package.json'));
} catch (error) {
  errors.push(`package.json no es JSON válido: ${error.message}`);
}

let updateManifest;
try {
  updateManifest = JSON.parse(read('updates/latest.json'));
} catch (error) {
  errors.push(`updates/latest.json no es JSON válido: ${error.message}`);
}

if (updateManifest) {
  if (updateManifest.name !== manifest?.name) {
    errors.push('updates/latest.json y plugin.json deben usar el mismo name');
  }
  if (updateManifest.version !== manifest?.version) {
    errors.push('updates/latest.json y plugin.json deben usar la misma version');
  }
  if (!/^https:\/\//.test(updateManifest.downloadUrl ?? '')) {
    errors.push('updates/latest.json debe usar una downloadUrl HTTPS');
  }
  if (!/^[a-f0-9]{64}$/i.test(updateManifest.sha256 ?? '')) {
    errors.push('updates/latest.json debe contener un SHA-256 válido');
  }
}

if (extensionManifest) {
  if (extensionManifest.name !== manifest?.name) {
    errors.push('package.json y plugin.json deben usar el mismo name');
  }
  if (extensionManifest.version !== manifest?.version) {
    errors.push('package.json y plugin.json deben usar la misma version');
  }
  if (extensionManifest.main !== './extension.js') {
    errors.push('package.json debe declarar extension.js como main');
  }
  if (!fs.existsSync(path.join(root, 'extension.js'))) {
    errors.push('Falta extension.js');
  }
  if (!fs.existsSync(path.join(root, 'src', 'update-manifest.js'))) {
    errors.push('Falta src/update-manifest.js');
  }
  if (!fs.existsSync(path.join(root, 'src', 'global-path.js'))) {
    errors.push('Falta src/global-path.js');
  }
  if (!fs.existsSync(path.join(root, 'customizations', 'USAGE.md'))) {
    errors.push('Falta customizations/USAGE.md');
  }
  if (extensionManifest.contributes?.configuration?.properties?.['devinGlobalCustomizations.updates.manifestUrl']?.default
      !== 'https://alejandrojl.github.io/DevinExtensionSample/updates/latest.json') {
    errors.push('package.json debe declarar la URL por defecto del manifiesto de GitHub Pages');
  }
  for (const command of [
    'devinGlobalCustomizations.installGlobally',
    'devinGlobalCustomizations.checkForUpdates',
    'devinGlobalCustomizations.installUpdate',
    'devinGlobalCustomizations.openCustomizations',
  ]) {
    if (!(extensionManifest.contributes?.commands ?? []).some((entry) => entry.command === command)) {
      errors.push(`package.json no declara el comando ${command}`);
    }
  }

  for (const contribution of extensionManifest.contributes?.chatAgents ?? []) {
    if (!fs.existsSync(path.join(root, contribution.path))) {
      errors.push(`chatAgents apunta a un archivo inexistente: ${contribution.path}`);
    }
  }
  for (const contribution of extensionManifest.contributes?.chatSkills ?? []) {
    if (!fs.existsSync(path.join(root, contribution.path))) {
      errors.push(`chatSkills apunta a un archivo inexistente: ${contribution.path}`);
    }
  }
}

if (manifest) {
  if (!/^[a-z0-9-]{1,64}$/.test(manifest.name ?? '')) {
    errors.push('plugin.json: name debe usar kebab-case y tener hasta 64 caracteres');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) {
    errors.push('plugin.json: version debe seguir SemVer básica');
  }
}

function validateMarkdown(relativePath, expectedName, extension) {
  const content = read(relativePath);
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) {
    errors.push(`${relativePath}: falta frontmatter YAML`);
    return;
  }

  const nameMatch = frontmatter[1].match(/^name:\s*([^\n]+)$/m);
  if (!nameMatch || nameMatch[1].trim() !== expectedName) {
    errors.push(`${relativePath}: name debe ser ${expectedName}`);
  }

  if (extension === '.agent.md' && !/^description:\s*.+$/m.test(frontmatter[1])) {
    errors.push(`${relativePath}: falta description`);
  }
}

function validateCanonicalSource() {
  const sourceRoot = path.join(root, 'customizations');
  for (const directory of ['agents', 'skills', 'rules', 'workflows']) {
    if (!fs.existsSync(path.join(sourceRoot, directory))) {
      errors.push(`Falta customizations/${directory}/`);
    }
  }

  const agentsPath = path.join(sourceRoot, 'agents');
  if (fs.existsSync(agentsPath)) {
    for (const entry of fs.readdirSync(agentsPath)) {
      if (!entry.endsWith('.agent.md')) {
        errors.push(`customizations/agents/${entry}: los agentes deben terminar en .agent.md`);
        continue;
      }
      validateMarkdown(
        `customizations/agents/${entry}`,
        entry.replace(/\.agent\.md$/, ''),
        '.agent.md',
      );
    }
  }

  const skillsPath = path.join(sourceRoot, 'skills');
  if (fs.existsSync(skillsPath)) {
    for (const entry of fs.readdirSync(skillsPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(skillsPath, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        errors.push(`Falta customizations/skills/${entry.name}/SKILL.md`);
      } else {
        validateMarkdown(`customizations/skills/${entry.name}/SKILL.md`, entry.name, '.md');
      }
    }
  }
}

validateCanonicalSource();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Plugin válido: ${manifest.name} v${manifest.version}`);
