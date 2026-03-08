import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const specsDir = join(repoRoot, 'specs', 'third-party');
const outputDir = join(__dirname, '..', 'src', 'generated');

await mkdir(outputDir, { recursive: true });

const files = (await readdir(specsDir)).filter(
  (name) => name.endsWith('.yaml') || name.endsWith('.yml'),
);
if (files.length === 0) {
  console.log('No third-party OpenAPI YAML files found.');
  process.exit(0);
}

for (const file of files) {
  const specPath = join(specsDir, file);
  const specFileUrl = pathToFileURL(specPath);
  const tsAst = await openapiTS(specFileUrl, { alphabetize: true });
  const tsSource = astToString(tsAst);
  const outFile = join(outputDir, `${parse(file).name}.ts`);
  await writeFile(outFile, tsSource);
  console.log(`Generated: ${outFile}`);
}
