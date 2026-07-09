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

const manifestPath = path.join(root, 'plugin.json');
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

if (extensionManifest) {
  if (extensionManifest.name !== manifest?.name) {
    errors.push('package.json y plugin.json deben usar el mismo name');
  }
  if (extensionManifest.version !== manifest?.version) {
    errors.push('package.json y plugin.json deben usar la misma version');
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

for (const directory of ['agents', 'skills']) {
  const directoryPath = path.join(root, directory);
  if (!fs.existsSync(directoryPath)) {
    errors.push(`Falta el directorio ${directory}/`);
    continue;
  }

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (!entry.isDirectory() && directory === 'agents') continue;
    const entryPath = path.join(directoryPath, entry.name);
    if (directory === 'skills') {
      const skillPath = path.join(entryPath, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        errors.push(`Falta ${directory}/${entry.name}/SKILL.md`);
      } else {
        validateMarkdown(`${directory}/${entry.name}/SKILL.md`, entry.name, '.md');
      }
    }
  }
}

const agentsPath = path.join(root, 'agents');
if (fs.existsSync(agentsPath)) {
  for (const entry of fs.readdirSync(agentsPath)) {
    if (!entry.endsWith('.agent.md')) {
      errors.push(`agents/${entry}: los agentes deben terminar en .agent.md`);
      continue;
    }
    validateMarkdown(`agents/${entry}`, entry.replace(/\.agent\.md$/, ''), '.agent.md');
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Plugin válido: ${manifest.name} v${manifest.version}`);
