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
  if (extensionManifest.main !== './extension.js') {
    errors.push('package.json debe declarar extension.js como main');
  }
  if (!fs.existsSync(path.join(root, 'extension.js'))) {
    errors.push('Falta extension.js');
  }
  for (const command of [
    'devinGlobalCustomizations.installGlobally',
    'devinGlobalCustomizations.checkForUpdates',
    'devinGlobalCustomizations.installUpdate',
    'devinGlobalCustomizations.configureGitHubToken',
    'devinGlobalCustomizations.clearGitHubToken',
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

function validateDevinSkillMirror() {
  const sourcePath = path.join(root, 'skills');
  const targetPath = path.join(root, '.devin', 'skills');
  if (!fs.existsSync(sourcePath)) return;

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const expectedFile = path.join(targetPath, entry.name, 'SKILL.md');
    if (!fs.existsSync(expectedFile)) {
      errors.push(`Falta la definición Devin ${path.relative(root, expectedFile)}`);
    }
  }
}

function validateDevinAgentMirror() {
  const sourcePath = path.join(root, 'agents');
  const targetPath = path.join(root, '.devin', 'agents');
  if (!fs.existsSync(sourcePath)) return;

  for (const entry of fs.readdirSync(sourcePath)) {
    if (!entry.endsWith('.agent.md')) continue;
    const agentName = entry.replace(/\.agent\.md$/, '');
    const expectedFile = path.join(targetPath, agentName, 'AGENT.md');
    if (!fs.existsSync(expectedFile)) {
      errors.push(`Falta la definición Devin ${path.relative(root, expectedFile)}`);
    }
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

validateDevinAgentMirror();
validateDevinSkillMirror();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Plugin válido: ${manifest.name} v${manifest.version}`);
