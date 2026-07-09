const fs = require('node:fs');
const path = require('node:path');

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`No existe el directorio de definiciones: ${source}`);
  }

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function getMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile()
      && entry.name.endsWith('.md')
      && entry.name !== 'README.md')
    .map((entry) => path.join(directory, entry.name));
}

function parseFrontmatter(content, sourcePath) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`Falta frontmatter YAML en ${sourcePath}`);
  }

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([\w-]+):\s*(.+)$/);
    if (field) frontmatter[field[1]] = field[2].trim();
  }

  return {
    body: content.slice(match[0].length).trimStart(),
    description: frontmatter.description?.replace(/^['"]|['"]$/g, '') || '',
    name: frontmatter.name?.replace(/^['"]|['"]$/g, '') || '',
  };
}

function agentNameFromPath(agentPath) {
  return path.basename(agentPath).replace(/\.agent\.md$/, '');
}

function readAgent(agentPath) {
  const content = fs.readFileSync(agentPath, 'utf8');
  const definition = parseFrontmatter(content, agentPath);
  const name = definition.name || agentNameFromPath(agentPath);
  if (!definition.description) {
    throw new Error(`Falta description en ${agentPath}`);
  }

  return { ...definition, name };
}

function listAgents(sourceRoot) {
  return fs.readdirSync(path.join(sourceRoot, 'agents'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.agent.md'))
    .map((entry) => path.join(sourceRoot, 'agents', entry.name));
}

function writeCascadeWorkflow(agent, destination) {
  const content = [
    '---',
    `description: ${JSON.stringify(agent.description)}`,
    '---',
    '',
    agent.body.trim(),
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, 'utf8');
}

function installDevinDefinitions(sourceRoot, targetRoot) {
  copyDirectory(path.join(sourceRoot, 'skills'), path.join(targetRoot, 'skills'));

  for (const agentPath of listAgents(sourceRoot)) {
    const agent = readAgent(agentPath);
    const destination = path.join(targetRoot, 'agents', agent.name, 'AGENT.md');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(agentPath, destination);
  }
}

function installCascadeDefinitions(sourceRoot, targetRoot) {
  copyDirectory(path.join(sourceRoot, 'skills'), path.join(targetRoot, 'skills'));
  fs.mkdirSync(path.join(targetRoot, 'global_workflows'), { recursive: true });

  for (const agentPath of listAgents(sourceRoot)) {
    const agent = readAgent(agentPath);
    writeCascadeWorkflow(
      agent,
      path.join(targetRoot, 'global_workflows', `${agent.name}.md`),
    );
  }

  const workflowSource = path.join(sourceRoot, 'workflows');
  for (const workflowPath of getMarkdownFiles(workflowSource)) {
    fs.copyFileSync(
      workflowPath,
      path.join(targetRoot, 'global_workflows', path.basename(workflowPath)),
    );
  }

  const ruleFiles = getMarkdownFiles(path.join(sourceRoot, 'rules'));
  if (ruleFiles.length > 0) {
    const rules = ruleFiles.map((rulePath) => (
      `## ${path.basename(rulePath, '.md')}\n\n${fs.readFileSync(rulePath, 'utf8').trim()}`
    )).join('\n\n');
    const globalRulesPath = path.join(targetRoot, 'memories', 'global_rules.md');
    fs.mkdirSync(path.dirname(globalRulesPath), { recursive: true });
    fs.writeFileSync(globalRulesPath, `${rules}\n`, 'utf8');
  }
}

function buildCustomizationTargets(extensionRoot, { cascadeRoot, devinRoot }) {
  const sourceRoot = path.join(extensionRoot, 'customizations');
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`No existe la carpeta canónica de definiciones: ${sourceRoot}`);
  }

  installDevinDefinitions(sourceRoot, devinRoot);
  installCascadeDefinitions(sourceRoot, cascadeRoot);

  return { cascadeRoot, devinRoot };
}

module.exports = {
  buildCustomizationTargets,
};
