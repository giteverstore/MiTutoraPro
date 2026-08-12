import JSZip from 'jszip';

const STARTER_ARTIFACT = /^(?:\s*#.*\b(?:todo|implement|implementation|replace|your code)\b.*|\s*pass\s*(?:#.*)?|\s*return\s+(?:None|NotImplemented)\s*#.*\b(?:todo|placeholder|implement)\b.*)$/i;

function linesWithEndings(value) {
  return value.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) ?? [];
}

function lineContent(line) {
  return line.replace(/(?:\r\n|\n|\r)$/, '');
}

export function removeStarterArtifacts(project, submission) {
  const ownedArtifacts = new Set(
    linesWithEndings(project.starterCode).map(lineContent).filter((line) => STARTER_ARTIFACT.test(line)),
  );
  if (!ownedArtifacts.size) return submission;
  return linesWithEndings(submission)
    .filter((line) => !ownedArtifacts.has(lineContent(line)))
    .join('');
}

function readme(project) { return `# ${project.title}\n\n${project.description}\n\n## Skills practiced\n${project.skills.map((skill) => `- ${skill}`).join('\n')}\n\n## Requirements\n${project.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Setup\nRequires Python 3. Run the public tests with:\n\n\`\`\`bash\npython -m unittest discover tests\n\`\`\`\n\n## Usage\nImport \`${project.functionDefinition.name}\` from \`${project.template.sourcePath}\`.\n\n## Example\nInput: \`${project.example.input}\`  \nOutput: \`${project.example.output}\`\n\nBuilt as part of Mi Tutora Pro.\n`; }
function pythonLiteral(value) { if (value === null) return 'None'; if (value === true) return 'True'; if (value === false) return 'False'; if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(', ')}]`; if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${pythonLiteral(key)}: ${pythonLiteral(item)}`).join(', ')}}`; return JSON.stringify(value); }
function testMethodNames(tests) {
  const used = new Map();
  return tests.map(({ name }) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^\d+|^_+|_+$/g, '') || 'behavior';
    const occurrence = (used.get(base) ?? 0) + 1;
    used.set(base, occurrence);
    return `test_${base}${occurrence > 1 ? `_${occurrence}` : ''}`;
  });
}
function publicTests(project) {
  const visible = project.validation.tests.filter(({ visible }) => visible);
  const names = testMethodNames(visible);
  return `import sys\nimport unittest\nfrom pathlib import Path\nsys.path.insert(0, str(Path(__file__).parents[1] / "src"))\nfrom ${project.moduleName} import ${project.functionDefinition.name}\n\nclass ProjectTests(unittest.TestCase):\n${visible.map((test, index) => `    def ${names[index]}(self):\n        self.assertEqual(${project.functionDefinition.name}(*${pythonLiteral(test.args)}), ${pythonLiteral(test.expected)})`).join('\n\n')}\n\nif __name__ == '__main__':\n    unittest.main()\n`;
}
export class ProjectExporter {
  async createArchive(project, submission, type = 'blob') {
    const zip = new JSZip(); const root = zip.folder(project.export.repositoryName);
    root.file('README.md', readme(project)); root.file(project.template.sourcePath, removeStarterArtifacts(project, submission)); root.file(project.template.testPath, publicTests(project)); root.file('requirements.txt', ''); root.file('.gitignore', '__pycache__/\n*.py[cod]\n.venv/\n');
    return zip.generateAsync({ type });
  }
  async download(project, submission) { const blob = await this.createArchive(project, submission); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${project.export.repositoryName}.zip`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
}
export const projectExporter = new ProjectExporter();
