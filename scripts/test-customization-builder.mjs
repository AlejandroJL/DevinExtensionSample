import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import builder from '../src/customization-builder.js';

const { buildCustomizationTargets } = builder;
const extensionRoot = process.cwd();
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-customizations-'));
const devinRoot = path.join(temporaryRoot, 'devin');
const cascadeRoot = path.join(temporaryRoot, 'windsurf');

try {
  buildCustomizationTargets(extensionRoot, { cascadeRoot, devinRoot });

  assert.ok(fs.existsSync(path.join(devinRoot, 'agents', 'global-planner', 'AGENT.md')));
  assert.ok(fs.existsSync(path.join(devinRoot, 'skills', 'project-discovery', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(cascadeRoot, 'skills', 'safe-release', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(cascadeRoot, 'global_workflows', 'global-reviewer.md')));

  const workflow = fs.readFileSync(
    path.join(cascadeRoot, 'global_workflows', 'update-sentinel.md'),
    'utf8',
  );
  assert.match(workflow, /description:/);
  assert.match(workflow, /Update Sentinel/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('La fuente canónica genera correctamente los destinos de Devin y Windsurf');
