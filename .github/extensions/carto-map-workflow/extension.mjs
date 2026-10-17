import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanvasError, createCanvas, joinSession } from '@github/copilot-sdk/extension';
import { workflow } from './workflow.mjs';

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const instances = new Map();

async function startServer() {
  let assets;
  try {
    const [html, css, javascript] = await Promise.all([
      readFile(join(extensionDirectory, 'index.html')),
      readFile(join(extensionDirectory, 'workflow.css')),
      readFile(join(extensionDirectory, 'workflow.js')),
    ]);
    assets = new Map([
      ['/', { contentType: 'text/html; charset=utf-8', body: html }],
      ['/workflow.css', { contentType: 'text/css; charset=utf-8', body: css }],
      ['/workflow.js', { contentType: 'text/javascript; charset=utf-8', body: javascript }],
    ]);
  } catch (error) {
    throw new CanvasError('MAP_WORKFLOW_ASSET_ERROR', `Unable to load map workflow assets: ${error instanceof Error ? error.message : String(error)}`);
  }

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };

    if (request.method !== 'GET') {
      response.writeHead(405, { ...headers, Allow: 'GET' });
      response.end('Method not allowed');
      return;
    }

    if (requestUrl.pathname === '/api/workflow') {
      response.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(workflow));
      return;
    }

    const asset = assets.get(requestUrl.pathname);
    if (!asset) {
      response.writeHead(404, headers);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      ...headers,
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'",
      'Content-Type': asset.contentType,
    });
    response.end(asset.body);
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    throw new CanvasError('MAP_WORKFLOW_SERVER_ERROR', `Unable to start the map workflow canvas: ${error instanceof Error ? error.message : String(error)}`);
  }

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise(resolve => server.close(resolve));
    throw new CanvasError('MAP_WORKFLOW_SERVER_ERROR', 'The map workflow canvas did not receive a valid local address.');
  }

  return { server, url: `http://127.0.0.1:${address.port}/` };
}

function getInstanceId(context) {
  const instanceId = typeof context === 'string' ? context : context?.instanceId;
  if (typeof instanceId !== 'string' || instanceId.trim().length === 0 || instanceId.length > 200) {
    throw new CanvasError('INVALID_INSTANCE_ID', 'A valid canvas instance ID is required.');
  }
  return instanceId;
}

async function open({ instanceId }) {
  const id = getInstanceId(instanceId);
  let serverPromise = instances.get(id);
  if (!serverPromise) {
    serverPromise = startServer();
    instances.set(id, serverPromise);
    serverPromise.catch(() => {
      if (instances.get(id) === serverPromise) instances.delete(id);
    });
  }

  const liveServer = await serverPromise;
  return { title: 'Carto-MH map workflow', url: liveServer.url };
}

async function onClose(context) {
  const id = getInstanceId(context);
  const serverPromise = instances.get(id);
  if (!serverPromise) return;
  instances.delete(id);

  try {
    const { server } = await serverPromise;
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  } catch (error) {
    throw new CanvasError('MAP_WORKFLOW_CLOSE_ERROR', `Unable to close the map workflow canvas: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await joinSession({
  canvases: [
    createCanvas({
      id: 'carto-mh-map-workflow',
      displayName: 'Carto-MH map workflow',
      description: 'Visualize how Mountyhall source data becomes an interactive 3D map and navigable routes.',
      actions: [
        {
          name: 'get-map-workflow',
          description: 'Return the repository-backed stages and supporting flows that create and power the Carto-MH map.',
          handler: async () => workflow,
        },
      ],
      open,
      onClose,
    }),
  ],
});
