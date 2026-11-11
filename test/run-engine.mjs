// Quick manual run: node test/run-engine.mjs <video> [model]
import { createRequire } from 'module';
import os from 'os'; import path from 'path';
const require = createRequire(import.meta.url);
const { transcribe } = require('../src/core/transcribe.js');
const C = require('../src/core/captions.js');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const models = path.join(os.homedir(), 'Library/Application Support/Captionshaper/models');
export const bins = { ffmpeg: path.join(root, 'vendor/ffmpeg/darwin-arm64/ffmpeg'), whisperDir: path.join(root, 'vendor/whisper/darwin-arm64'), vadModel: path.join(root, 'vendor/models/ggml-silero-v5.1.2.bin') };
if (process.argv[2]) {
  const t0 = Date.now();
  const r = await transcribe(bins, { input: process.argv[2], model: path.join(models, process.argv[3] || 'ggml-large-v3-turbo-q5_0.bin'), language: process.argv[4] || 'auto' });
  console.log('lang', r.language, 'regions', r.regions.map((x) => `${x.start.toFixed(2)}-${x.end.toFixed(2)}`).join(' '), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const caps = C.buildCaptions(r.words, { noSpace: r.noSpace });
  console.log(C.toSRT(caps));
  const pop = C.buildCaptions(r.words, { noSpace: r.noSpace, ...C.STYLES.pop });
  console.log(pop.map((c) => `${c.start.toFixed(2)}-${c.end.toFixed(2)} ${C.captionLines(c).join(' / ')}`).join('\n'));
}
