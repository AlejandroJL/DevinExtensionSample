const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const updater = require('./src/updater');
const { buildCustomizationTargets } = require('./src/customization-builder');
const {
  getGlobalCascadeRoot,
  getGlobalDevinRoot,
} = require('./src/global-path');

const INSTALL_COMMAND = 'devinGlobalCustomizations.installGlobally';
const OPEN_FOLDER_COMMAND = 'devinGlobalCustomizations.openGlobalFolder';
const CHECK_UPDATES_COMMAND = 'devinGlobalCustomizations.checkForUpdates';
const INSTALL_UPDATE_COMMAND = 'devinGlobalCustomizations.installUpdate';
const OPEN_CUSTOMIZATIONS_COMMAND = 'devinGlobalCustomizations.openCustomizations';
const GLOBAL_INSTALLATION_VERSION_KEY = 'globalInstallationVersion';

let customizationsPanel;

function readFrontmatterMetadata(filePath, fallbackName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const metadata = { description: '', name: fallbackName };
  if (!frontmatter) return metadata;

  for (const line of frontmatter[1].split('\n')) {
    const field = line.match(/^([\w-]+):\s*(.+)$/);
    if (!field) continue;
    const value = field[2].trim().replace(/^['"]|['"]$/g, '');
    if (field[1] === 'name') metadata.name = value;
    if (field[1] === 'description') metadata.description = value;
  }
  return metadata;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readDefinition(filePath, fallbackName) {
  const metadata = readFrontmatterMetadata(filePath, fallbackName);
  const content = fs.readFileSync(filePath, 'utf8');
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  return { ...metadata, body };
}

function readAgentDefinitions(customizationsRoot) {
  const agentsRoot = path.join(customizationsRoot, 'agents');
  return fs.readdirSync(agentsRoot)
    .filter((entry) => entry.endsWith('.agent.md'))
    .sort()
    .map((entry) => readDefinition(
      path.join(agentsRoot, entry),
      entry.replace(/\.agent\.md$/, ''),
    ));
}

function readSkillDefinitions(customizationsRoot) {
  const skillsRoot = path.join(customizationsRoot, 'skills');
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => readDefinition(
      path.join(skillsRoot, entry.name, 'SKILL.md'),
      entry.name,
    ));
}

function renderDefinition(definition) {
  return `<article class="definition"><h3>${escapeHtml(definition.name)}</h3><p class="description">${escapeHtml(definition.description)}</p><pre>${escapeHtml(definition.body)}</pre></article>`;
}

function createCustomizationsHtml(extensionRoot) {
  const customizationsRoot = path.join(extensionRoot, 'customizations');
  const usage = fs.readFileSync(path.join(customizationsRoot, 'USAGE.md'), 'utf8');
  const agents = readAgentDefinitions(customizationsRoot);
  const skills = readSkillDefinitions(customizationsRoot);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { color: var(--vscode-foreground); font-family: var(--vscode-font-family); padding: 0 24px 32px; line-height: 1.5; }
    h1 { font-size: 1.6em; margin-bottom: 4px; }
    h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px; margin-top: 28px; }
    h3 { margin-bottom: 4px; }
    .intro { color: var(--vscode-descriptionForeground); }
    .definition { border-left: 3px solid var(--vscode-textLink-foreground); padding: 4px 0 4px 14px; margin: 18px 0; }
    .description { color: var(--vscode-descriptionForeground); margin-top: 0; }
    pre { white-space: pre-wrap; font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 12px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Devin &amp; Cascade Customizations</h1>
  <p class="intro">Agentes, skills y workflows disponibles desde la extensión.</p>
  <section><h2>Usage</h2><pre>${escapeHtml(usage.replace(/^# Usage\s*/, '').trim())}</pre></section>
  <section><h2>Agents</h2>${agents.map(renderDefinition).join('')}</section>
  <section><h2>Skills</h2>${skills.map(renderDefinition).join('')}</section>
</body>
</html>`;
}

function openCustomizationsPanel(extensionRoot) {
  if (customizationsPanel) {
    customizationsPanel.reveal(vscode.ViewColumn.One);
    customizationsPanel.webview.html = createCustomizationsHtml(extensionRoot);
    return;
  }

  customizationsPanel = vscode.window.createWebviewPanel(
    'devinGlobalCustomizations.info',
    'Devin & Cascade Customizations',
    vscode.ViewColumn.One,
    { enableScripts: false, retainContextWhenHidden: true },
  );
  customizationsPanel.webview.html = createCustomizationsHtml(extensionRoot);
  customizationsPanel.onDidDispose(() => {
    customizationsPanel = undefined;
  });
}

function installGlobally(extensionRoot) {
  return buildCustomizationTargets(extensionRoot, {
    cascadeRoot: getGlobalCascadeRoot(),
    devinRoot: getGlobalDevinRoot(),
  });
}

function getExtensionVersion(extensionRoot) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
  return packageJson.version;
}

async function installGlobalCustomizationsOnActivation(context) {
  const configuration = vscode.workspace.getConfiguration('devinGlobalCustomizations');
  if (!configuration.get('installOnActivation', true)) return;

  const version = getExtensionVersion(context.extensionPath);
  const devinRoot = getGlobalDevinRoot();
  const cascadeRoot = getGlobalCascadeRoot();
  const installedVersion = context.globalState.get(GLOBAL_INSTALLATION_VERSION_KEY);
  const targetsExist = fs.existsSync(path.join(devinRoot, 'agents'))
    && fs.existsSync(path.join(devinRoot, 'skills'))
    && fs.existsSync(path.join(cascadeRoot, 'skills'))
    && fs.existsSync(path.join(cascadeRoot, 'global_workflows'));

  if (installedVersion === version && targetsExist) return;

  try {
    installGlobally(context.extensionPath);
    await context.globalState.update(GLOBAL_INSTALLATION_VERSION_KEY, version);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const action = await vscode.window.showWarningMessage(
      `No se pudieron instalar automáticamente los agentes y skills de Devin: ${message}`,
      'Reintentar ahora',
    );
    if (action === 'Reintentar ahora') {
      try {
        installGlobally(context.extensionPath);
        await context.globalState.update(GLOBAL_INSTALLATION_VERSION_KEY, version);
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        vscode.window.showErrorMessage(`La instalación automática sigue fallando: ${retryMessage}`);
      }
    }
  }
}

function activate(context) {
  const install = vscode.commands.registerCommand(INSTALL_COMMAND, async () => {
    const devinRoot = getGlobalDevinRoot();
    const cascadeRoot = getGlobalCascadeRoot();
    const choice = await vscode.window.showInformationMessage(
      `Se instalarán las definiciones para Devin en ${devinRoot} y para Cascade en ${cascadeRoot}. Los archivos existentes con el mismo nombre se actualizarán.`,
      { modal: true },
      'Instalar / actualizar',
      'Cancelar',
    );

    if (choice !== 'Instalar / actualizar') return;

    try {
      const installedRoots = installGlobally(context.extensionPath);
      vscode.window.showInformationMessage(
        `Definiciones instaladas para Devin en ${installedRoots.devinRoot} y para Cascade en ${installedRoots.cascadeRoot}. Recarga Cascade o reinicia el IDE si no aparecen inmediatamente.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`No se pudieron instalar las definiciones globales de Devin: ${message}`);
    }
  });

  const openFolder = vscode.commands.registerCommand(OPEN_FOLDER_COMMAND, async () => {
    const targetRoot = getGlobalDevinRoot();
    fs.mkdirSync(targetRoot, { recursive: true });
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetRoot));
  });

  const openCustomizations = vscode.commands.registerCommand(
    OPEN_CUSTOMIZATIONS_COMMAND,
    () => openCustomizationsPanel(context.extensionPath),
  );

  const checkForUpdates = vscode.commands.registerCommand(CHECK_UPDATES_COMMAND, async () => {
    try {
      await updater.checkForUpdates(context, { interactive: true, notify: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`No se pudieron comprobar las actualizaciones web de Devin: ${message}`);
    }
  });

  const installUpdate = vscode.commands.registerCommand(INSTALL_UPDATE_COMMAND, async () => {
    try {
      const update = await updater.checkForUpdates(context, { interactive: true, notify: false });
      if (update) await updater.installUpdate(context, update);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`No se pudo instalar la actualización de Devin: ${message}`);
    }
  });

  context.subscriptions.push(
    install,
    openFolder,
    openCustomizations,
    checkForUpdates,
    installUpdate,
  );
  void installGlobalCustomizationsOnActivation(context);
  void updater.autoCheck(context);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  getGlobalCascadeRoot,
  getGlobalDevinRoot,
  installGlobally,
};
