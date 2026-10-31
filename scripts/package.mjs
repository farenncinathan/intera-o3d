import { readFile, readdir, mkdir, writeFile, copyFile, stat } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A portable ZIP writer using only Node.js. An explicit allowlist prevents
// credentials, node_modules, Git history and previous ZIPs entering the archive.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output-dir')) {
  throw new Error('Uso: node scripts/package.mjs [--output-dir pasta]');
}
const output = args.length ? resolve(args[1]) : join(root, 'downloads');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await stat(join(root, 'dist', 'index.html')).catch(() => {
  throw new Error('Build ausente. Execute npm run package para compilar e gerar o ZIP.');
});

const paths = [];
async function collect(relative) {
  const entry = await stat(join(root, relative));
  if (entry.isDirectory()) {
    const children = await readdir(join(root, relative), { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (child.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${relative}/${child.name}`);
      await collect(`${relative}/${child.name}`);
    }
  } else if (entry.isFile()) paths.push(relative);
}
for (const path of ['.gitignore', '.nvmrc', 'README.md', 'CHANGELOG.md', 'package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'src', 'public', 'tests', 'scripts', 'dist']) {
  await collect(path);
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

const localEntries = [], centralEntries = [];
let offset = 0;
for (const path of paths) {
  const name = Buffer.from(path, 'utf8');
  const data = await readFile(join(root, path));
  const compressed = deflateRawSync(data, { level: 9 });
  const checksum = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // ZIP 2.0
  local.writeUInt16LE(0x0800, 6); // UTF-8 filenames
  local.writeUInt16LE(8, 8); // DEFLATE
  local.writeUInt16LE(33, 12); // Fixed 1980-01-01 for reproducible archives
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  localEntries.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centralEntries.push(central, name);
  offset += local.length + name.length + compressed.length;
}
const directory = Buffer.concat(centralEntries);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(paths.length, 8);
end.writeUInt16LE(paths.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...localEntries, directory, end]);
await mkdir(output, { recursive: true });
const versioned = join(output, `intera-o3d-v${manifest.version}.zip`);
await writeFile(versioned, zip);
await copyFile(versioned, join(output, 'intera-o3d.zip'));
console.log(`ZIP ${manifest.version}: ${paths.length} arquivos, ${zip.length} bytes. package.json na raiz.\n${versioned}`);
