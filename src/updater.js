const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');
const {
  downloadAsset,
  getUpdateManifest,
  sha256File,
} = require('./update-manifest');

const TOKEN_SECRET_KEY = 'githubPagesToken';
const LAST_CHECK_KEY = 'lastUpdateCheck';

function parseVersion(value) {
  const match = String(value).replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function getManifest(extensionRoot) {
  const manifestPath = path.join(extensionRoot, 'package.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function getUpdateManifestUrl() {
  return vscode.workspace
    .getConfiguration('devinGlobalCustomizations.updates')
    .get('manifestUrl');
}

async function getToken(context, interactive) {
  const storedToken = await context.secrets.get(TOKEN_SECRET_KEY);
  if (storedToken) return storedToken;

  if (vscode.authentication?.getSession) {
    try {
      const session = await vscode.authentication.getSession(
        'github',
        ['repo'],
        { createIfNone: interactive },
      );
      if (session?.accessToken) return session.accessToken;
    } catch {
      // The Pages manifest can be public; authentication is optional.
    }
  }

  return null;
}

function validateUpdateManifest(updateManifest, packageName) {
  if (updateManifest.name && updateManifest.name !== packageName) {
    throw new Error(`El manifiesto pertenece a ${updateManifest.name}, no a ${packageName}.`);
  }
  if (!parseVersion(updateManifest.version)) {
    throw new Error('El manifiesto no contiene una versión SemVer válida.');
  }
  if (!updateManifest.downloadUrl || new URL(updateManifest.downloadUrl).protocol !== 'https:') {
    throw new Error('El manifiesto debe contener una downloadUrl HTTPS.');
  }
  if (!/^[a-f0-9]{64}$/i.test(updateManifest.sha256 || '')) {
    throw new Error('El manifiesto no contiene un SHA-256 válido.');
  }
}

async function fetchManifest(context, interactive) {
  const manifestUrl = getUpdateManifestUrl();
  if (!manifestUrl) throw new Error('No hay una URL de manifiesto configurada.');

  try {
    return { manifestUrl, token: null, updateManifest: await getUpdateManifest(manifestUrl) };
  } catch (publicRequestError) {
    const token = await getToken(context, interactive);
    if (!token) throw publicRequestError;
    return { manifestUrl, token, updateManifest: await getUpdateManifest(manifestUrl, token) };
  }
}

async function checkForUpdates(context, { interactive = false, notify = true } = {}) {
  const extensionManifest = getManifest(context.extensionPath);
  const { manifestUrl, token, updateManifest } = await fetchManifest(context, interactive);
  validateUpdateManifest(updateManifest, extensionManifest.name);

  if (compareVersions(updateManifest.version, extensionManifest.version) <= 0) {
    if (interactive) {
      vscode.window.showInformationMessage(
        `Devin Global Customizations ya está actualizado (${extensionManifest.version}).`,
      );
    }
    return null;
  }

  const update = { extensionManifest, manifestUrl, token, updateManifest };
  await context.globalState.update('latestUpdate', {
    version: updateManifest.version,
    manifestUrl,
  });

  if (notify) {
    const action = await vscode.window.showInformationMessage(
      `Hay una nueva versión de Devin Global Customizations: ${updateManifest.version}.`,
      'Descargar e instalar',
      'Ver información',
      'Más tarde',
    );
    if (action === 'Descargar e instalar') await installUpdate(context, update);
    if (action === 'Ver información' && updateManifest.releaseNotesUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(updateManifest.releaseNotesUrl));
    }
  }

  return update;
}

async function installUpdate(context, update) {
  const token = update.token || await getToken(context, true);
  const fileName = update.updateManifest.fileName
    || `devin-global-customizations-${update.updateManifest.version}.vsix`;
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-global-update-'));
  const vsixPath = path.join(temporaryDirectory, fileName);

  try {
    await downloadAsset(update.updateManifest.downloadUrl, vsixPath, token);
    const actualDigest = await sha256File(vsixPath);
    const expectedDigest = update.updateManifest.sha256.toLowerCase();
    if (actualDigest !== expectedDigest) {
      throw new Error(`El checksum no coincide. Esperado ${expectedDigest}, obtenido ${actualDigest}.`);
    }

    await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
    const reload = await vscode.window.showInformationMessage(
      `Versión ${update.updateManifest.version} instalada. Recarga Devin Desktop para activarla.`,
      'Recargar ahora',
    );
    if (reload === 'Recargar ahora') await vscode.commands.executeCommand('workbench.action.reloadWindow');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function configureToken(context) {
  const token = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    password: true,
    prompt: 'Token GitHub con acceso de lectura a la GitHub Page protegida',
    placeHolder: 'github_pat_…',
  });
  if (!token) return;
  await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
  vscode.window.showInformationMessage('Token de GitHub Pages guardado de forma segura.');
}

async function clearToken(context) {
  await context.secrets.delete(TOKEN_SECRET_KEY);
  vscode.window.showInformationMessage('Token de GitHub Pages eliminado de la extensión.');
}

async function autoCheck(context) {
  const configuration = vscode.workspace.getConfiguration('devinGlobalCustomizations.updates');
  if (!configuration.get('enabled', true)) return;

  const intervalHours = configuration.get('checkIntervalHours', 24);
  const lastCheck = context.globalState.get(LAST_CHECK_KEY, 0);
  if (Date.now() - lastCheck < intervalHours * 60 * 60 * 1000) return;

  await context.globalState.update(LAST_CHECK_KEY, Date.now());
  try {
    await checkForUpdates(context, { interactive: false, notify: true });
  } catch {
    // Automatic checks must never interrupt startup.
  }
}

module.exports = {
  autoCheck,
  checkForUpdates,
  clearToken,
  configureToken,
  installUpdate,
};
