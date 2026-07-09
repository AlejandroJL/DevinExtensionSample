const os = require('node:os');
const path = require('node:path');

/**
 * Returns Devin's user-level configuration directory for the host OS.
 *
 * Devin uses XDG-style storage on macOS/Linux and the Windows application
 * data directory on Windows. The optional arguments make the platform logic
 * easy to verify without changing the real process environment.
 */
function getGlobalDevinRoot({
  platform = process.platform,
  env = process.env,
  homeDirectory = os.homedir(),
  pathApi = path,
} = {}) {
  if (platform === 'win32') {
    const appDataDirectory = env.APPDATA
      || pathApi.join(homeDirectory, 'AppData', 'Roaming');
    return pathApi.join(appDataDirectory, 'devin');
  }

  return pathApi.join(homeDirectory, '.config', 'devin');
}

module.exports = { getGlobalDevinRoot };
