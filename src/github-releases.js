const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const API_VERSION = '2026-03-10';

function request(url, token, responseType = 'json', redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Demasiadas redirecciones al consultar GitHub.'));
      return;
    }

    const requestUrl = new URL(url);
    const headers = {
      Accept: responseType === 'json' ? 'application/vnd.github+json' : 'application/octet-stream',
      'User-Agent': 'DevinGlobalCustomizations',
      'X-GitHub-Api-Version': API_VERSION,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const requestOptions = {
      protocol: requestUrl.protocol,
      hostname: requestUrl.hostname,
      port: requestUrl.port || 443,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      headers,
    };

    const request = https.get(requestOptions, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        request(urlResolve(url, response.headers.location), token, responseType, redirects + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          reject(new Error(`GitHub respondió ${response.statusCode}: ${body.slice(0, 300)}`));
        });
        return;
      }

      if (responseType === 'json') {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`GitHub devolvió JSON inválido: ${error.message}`));
          }
        });
        return;
      }

      resolve(response);
    });

    request.on('error', reject);
  });
}

function urlResolve(base, location) {
  return new URL(location, base).toString();
}

function getLatestRelease(owner, repository, token) {
  const endpoint = `https://api.github.com/repos/${owner}/${repository}/releases/latest`;
  return request(endpoint, token, 'json');
}

async function downloadAsset(url, destination, token) {
  const response = await request(url, token, 'stream');
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination);
    response.pipe(output);
    output.on('finish', () => output.close(resolve));
    output.on('error', (error) => {
      output.close(() => {});
      fs.rmSync(destination, { force: true });
      reject(error);
    });
    response.on('error', (error) => {
      output.close(() => {});
      fs.rmSync(destination, { force: true });
      reject(error);
    });
  });
  return destination;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = {
  downloadAsset,
  getLatestRelease,
  sha256File,
};
