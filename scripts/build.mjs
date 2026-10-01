import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/app.html'), 'utf8');
const indexPath = resolve(root, 'index.html');
const index = readFileSync(indexPath, 'utf8');
const marker = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
if (!marker.test(index)) throw new Error('No se encontró el template empaquetado.');

// El HTML interno contiene </script>; codificar la barra impide que el navegador
// cierre prematuramente el script que guarda el template.
const payload = JSON.stringify(source).replace(/<\/script/gi, '<\\u002Fscript');
const next = index.replace(marker, (_, open, _old, close) => open + payload + close);
if (process.argv.includes('--check')) {
  if (next !== index) {
    console.error('index.html no coincide con src/app.html. Ejecuta node scripts/build.mjs.');
    process.exitCode = 1;
  }
} else if (next !== index) {
  writeFileSync(indexPath, next);
  console.log('index.html actualizado.');
}
