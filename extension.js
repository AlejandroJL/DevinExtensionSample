const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const updater = require('./src/updater');
const {
  getGlobalCascadeRoot,
  getGlobalDevinRoot,
} = require('./src/global-path');

const INSTALL_COMMAND = 'devinGlobalCustomizations.installGlobally';
const OPEN_FOLDER_COMMAND = 'devinGlobalCustomizations.openGlobalFolder';
const CHECK_UPDATES_COMMAND = 'devinGlobalCustomizations.checkForUpdates';
const INSTALL_UPDATE_COMMAND = 'devinGlobalCustomizations.installUpdate';
const GLOBAL_INSTALLATION_VERSION_KEY = 'globalInstallationVersion';

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`No existe el directorio de origen: ${source}`);
  }

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function installDevinGlobally(extensionRoot) {
  const sourceRoot = path.join(extensionRoot, '.devin');
  const targetRoot = getGlobalDevinRoot();

  copyDirectory(path.join(sourceRoot, 'agents'), path.join(targetRoot, 'agents'));
  copyDirectory(path.join(sourceRoot, 'skills'), path.join(targetRoot, 'skills'));

  return targetRoot;
}

function installCascadeGlobally(extensionRoot) {
  const sourceRoot = path.join(extensionRoot, '.codeium', 'windsurf', 'windsurf');
  const targetRoot = getGlobalCascadeRoot();

  copyDirectory(path.join(sourceRoot, 'skills'), path.join(targetRoot, 'skills'));
  copyDirectory(
    path.join(sourceRoot, 'workflows'),
    path.join(targetRoot, 'global_workflows'),
  );

  return targetRoot;
}

function installGlobally(extensionRoot) {
  return {
    cascadeRoot: installCascadeGlobally(extensionRoot),
    devinRoot: installDevinGlobally(extensionRoot),
  };
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

function createStatusBarItem(context) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = INSTALL_COMMAND;
  item.text = '$(cloud-download) Devin Global';
  item.tooltip = 'Instalar o actualizar agentes, skills y workflows de Devin/Cascade';
  item.show();
  context.subscriptions.push(item);
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
    checkForUpdates,
    installUpdate,
  );
  createStatusBarItem(context);
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
