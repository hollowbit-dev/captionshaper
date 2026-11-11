// Downloads the ffmpeg binary Fileshaper bundles for a platform/arch into vendor/ffmpeg/<platform>-<arch>/.
// Usage: node scripts/fetch-ffmpeg.mjs darwin arm64   (or: darwin x64, win32 x64)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const [platform, arch] = process.argv.slice(2);
if (!platform || !arch) { console.error('Usage: fetch-ffmpeg.mjs <platform> <arch>'); process.exit(1); }
const name = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const dir = path.join('vendor', 'ffmpeg', `${platform}-${arch}`);
const dest = path.join(dir, name);
if (fs.existsSync(dest)) { console.log(`Already have ${dest}`); process.exit(0); }
const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-${platform}-${arch}.gz`;
console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) { console.error(`Download failed: ${res.status}`); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dest, zlib.gunzipSync(Buffer.from(await res.arrayBuffer())));
fs.chmodSync(dest, 0o755);
console.log(`Saved ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
