const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');

function requestResource(url, responseType = 'json', redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Demasiadas redirecciones al consultar el servidor web.'));
      return;
    }

    const requestUrl = new URL(url);
    const headers = {
      Accept: responseType === 'json' ? 'application/json' : 'application/octet-stream',
      'User-Agent': 'DevinGlobalCustomizations',
    };
    const clientRequest = https.get({
      protocol: requestUrl.protocol,
      hostname: requestUrl.hostname,
      port: requestUrl.port || 443,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      headers,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        requestResource(new URL(response.headers.location, url).toString(), responseType, redirects + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          reject(new Error(`El servidor de actualización respondió ${response.statusCode}: ${body.slice(0, 300)}`));
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
            reject(new Error(`El manifiesto de actualización no es JSON válido: ${error.message}`));
          }
        });
        return;
      }

      resolve(response);
    });

    clientRequest.on('error', reject);
  });
}

function getUpdateManifest(url) {
  return requestResource(url, 'json');
}

async function downloadAsset(url, destination) {
  const response = await requestResource(url, 'stream');
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
  getUpdateManifest,
  sha256File,
};
