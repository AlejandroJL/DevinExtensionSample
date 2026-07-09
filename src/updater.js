const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');
const {
  downloadAsset,
  getLatestRelease,
  sha256File,
} = require('./github-releases');

const TOKEN_SECRET_KEY = 'githubToken';
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

function getRepository(manifest) {
  const repositoryUrl = manifest.repository?.url;
  const match = repositoryUrl?.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  if (!match) throw new Error('No se pudo determinar el repositorio GitHub desde package.json.');
  return { owner: match[1], repository: match[2] };
}

function getManifest(extensionRoot) {
  const manifestPath = path.join(extensionRoot, 'package.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
      // Continue without an interactive session; a stored token may still exist.
    }
  }

  return null;
}

function findVsixAsset(release, packageName) {
  const expectedName = `${packageName}-${String(release.tag_name).replace(/^v/i, '')}.vsix`;
  return release.assets?.find((asset) => asset.name === expectedName)
    || release.assets?.find((asset) => asset.name.endsWith('.vsix'));
}

function findDigestAsset(release) {
  return release.assets?.find((asset) => asset.name === 'SHA256SUMS.txt');
}

function readExpectedDigest(text, assetName) {
  const escapedName = assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^([a-f0-9]{64})\\s+\\*?${escapedName}\\s*$`, 'mi'));
  return match?.[1] || null;
}

async function expectedDigest(release, asset, token, temporaryDirectory) {
  if (asset.digest?.startsWith('sha256:')) return asset.digest.slice('sha256:'.length);

  const digestAsset = findDigestAsset(release);
  if (!digestAsset) return null;

  const digestPath = path.join(temporaryDirectory, digestAsset.name);
  await downloadAsset(digestAsset.browser_download_url, digestPath, token);
  return readExpectedDigest(fs.readFileSync(digestPath, 'utf8'), asset.name);
}

async function checkForUpdates(context, { interactive = false, notify = true } = {}) {
  const manifest = getManifest(context.extensionPath);
  const repository = getRepository(manifest);
  const token = await getToken(context, interactive);
  const release = await getLatestRelease(repository.owner, repository.repository, token);

  if (release.draft || release.prerelease) return null;
  const latestVersion = String(release.tag_name).replace(/^v/i, '');
  if (compareVersions(latestVersion, manifest.version) <= 0) {
    if (interactive) {
      vscode.window.showInformationMessage(`Devin Global Customizations ya está actualizado (${manifest.version}).`);
    }
    return null;
  }

  const asset = findVsixAsset(release, manifest.name);
  if (!asset) throw new Error(`La release ${release.tag_name} no contiene un archivo VSIX.`);

  const update = { asset, latestVersion, manifest, release, repository, token };
  await context.globalState.update('latestUpdate', {
    version: latestVersion,
    releaseUrl: release.html_url,
  });

  if (notify) {
    const action = await vscode.window.showInformationMessage(
      `Hay una nueva versión de Devin Global Customizations: ${latestVersion}.`,
      'Descargar e instalar',
      'Ver release',
      'Más tarde',
    );
    if (action === 'Descargar e instalar') await installUpdate(context, update);
    if (action === 'Ver release') await vscode.env.openExternal(vscode.Uri.parse(release.html_url));
  }

  return update;
}

async function installUpdate(context, update) {
  const token = update.token || await getToken(context, true);
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-global-update-'));
  const vsixPath = path.join(temporaryDirectory, update.asset.name);

  try {
    await downloadAsset(update.asset.browser_download_url, vsixPath, token);
    const actualDigest = await sha256File(vsixPath);
    const expected = await expectedDigest(update.release, update.asset, token, temporaryDirectory);
    if (!expected) throw new Error('La release no contiene un digest SHA-256 verificable.');
    if (actualDigest !== expected) {
      throw new Error(`El checksum no coincide. Esperado ${expected}, obtenido ${actualDigest}.`);
    }

    await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
    const reload = await vscode.window.showInformationMessage(
      `Versión ${update.latestVersion} instalada. Recarga Devin Desktop para activarla.`,
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
    prompt: 'Token GitHub con acceso de lectura al repositorio privado',
    placeHolder: 'github_pat_…',
  });
  if (!token) return;
  await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
  vscode.window.showInformationMessage('Token GitHub guardado de forma segura.');
}

async function clearToken(context) {
  await context.secrets.delete(TOKEN_SECRET_KEY);
  vscode.window.showInformationMessage('Token GitHub eliminado de la extensión.');
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
