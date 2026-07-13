import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'public', 'ocr');

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'lang'), { recursive: true });
await mkdir(join(output, 'core'), { recursive: true });

const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
  ['node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz', 'lang/chi_sim.traineddata.gz'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'core/tesseract-core-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'core/tesseract-core-simd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm', 'core/tesseract-core-relaxedsimd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
];

await Promise.all(copies.map(([source, target]) => copyFile(join(root, source), join(output, target))));

