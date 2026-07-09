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
const OPEN_DOCUMENT_COMMAND = 'devinGlobalCustomizations.openCustomizationDocument';
const TREE_VIEW_ID = 'devinGlobalCustomizations.customizations';
const GLOBAL_INSTALLATION_VERSION_KEY = 'globalInstallationVersion';

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

class CustomizationTreeItem extends vscode.TreeItem {
  constructor(label, collapsibleState, options = {}) {
    super(label, collapsibleState);
    this.contextValue = options.contextValue || 'customization';
    this.description = options.description;
    this.tooltip = options.tooltip || options.description || label;
    this.iconPath = options.icon ? new vscode.ThemeIcon(options.icon) : undefined;
    if (options.documentPath) {
      this.command = {
        command: OPEN_DOCUMENT_COMMAND,
        title: 'Open customization definition',
        arguments: [options.documentPath],
      };
    }
  }
}

class CustomizationTreeProvider {
  constructor(extensionRoot) {
    this.extensionRoot = extensionRoot;
    this.customizationsRoot = path.join(extensionRoot, 'customizations');
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      return [
        new CustomizationTreeItem('Usage', vscode.TreeItemCollapsibleState.Collapsed, {
          contextValue: 'usage',
          icon: 'book',
        }),
        new CustomizationTreeItem('Agents', vscode.TreeItemCollapsibleState.Collapsed, {
          contextValue: 'agents',
          icon: 'hubot',
        }),
        new CustomizationTreeItem('Skills', vscode.TreeItemCollapsibleState.Collapsed, {
          contextValue: 'skills',
          icon: 'lightbulb',
        }),
      ];
    }

    if (element.contextValue === 'usage') {
      return [this.createDocumentItem(
        'How to use agents and skills',
        path.join(this.customizationsRoot, 'USAGE.md'),
        'Open the usage guide',
        'book',
      )];
    }

    if (element.contextValue === 'agents') {
      return this.getDefinitionItems(
        path.join(this.customizationsRoot, 'agents'),
        (entry) => entry.endsWith('.agent.md'),
        (entry) => entry.replace(/\.agent\.md$/, ''),
        'hubot',
      );
    }

    if (element.contextValue === 'skills') {
      const skillsRoot = path.join(this.customizationsRoot, 'skills');
      if (!fs.existsSync(skillsRoot)) return [];
      return fs.readdirSync(skillsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
          const documentPath = path.join(skillsRoot, entry.name, 'SKILL.md');
          const metadata = readFrontmatterMetadata(documentPath, entry.name);
          return this.createDocumentItem(
            metadata.name,
            documentPath,
            metadata.description,
            'lightbulb',
          );
        });
    }

    return [];
  }

  getDefinitionItems(directory, filter, getName, icon) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory)
      .filter(filter)
      .sort()
      .map((entry) => {
        const documentPath = path.join(directory, entry);
        const metadata = readFrontmatterMetadata(documentPath, getName(entry));
        return this.createDocumentItem(metadata.name, documentPath, metadata.description, icon);
      });
  }

  createDocumentItem(label, documentPath, description, icon) {
    return new CustomizationTreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
      { description, documentPath, icon },
    );
  }
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

  const openDocument = vscode.commands.registerCommand(OPEN_DOCUMENT_COMMAND, async (documentPath) => {
    if (typeof documentPath !== 'string') return;
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(documentPath));
    await vscode.window.showTextDocument(document, { preview: false });
  });

  const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
    treeDataProvider: new CustomizationTreeProvider(context.extensionPath),
    showCollapseAll: true,
  });

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
    openDocument,
    treeView,
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
