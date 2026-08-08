/**
 * Self-hosts the tesseract.js worker script, WASM core, and English
 * language data into public/tesseract/ so the Aadhaar scanner never depends
 * on cdn.jsdelivr.net at runtime - that CDN is tesseract.js's default
 * fallback for all three assets when no local path is configured, and any
 * one of the three failing to load (CSP, ad-blocker, flaky mobile network,
 * a hosting provider not forwarding the request correctly) is enough to
 * make OCR hang or silently never resolve.
 *
 * Runs automatically via the "postinstall" npm script, so a fresh
 * `npm install` always regenerates these files from whatever's in
 * node_modules - nothing here needs to be hand-copied or committed as
 * binary blobs to source control beyond what npm already manages.
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'tesseract');
fs.mkdirSync(outDir, { recursive: true });

const copy = (from, to) => {
  fs.copyFileSync(from, to);
  console.log(`[tesseract self-host] copied ${path.basename(to)}`);
};

const require_resolve_safe = (id) => {
  try {
    return require.resolve(id);
  } catch (e) {
    console.warn(`[tesseract self-host] could not resolve ${id} - skipping (${e.message})`);
    return null;
  }
};

// 1. Worker script
const workerSrc = require_resolve_safe('tesseract.js/dist/worker.min.js');
if (workerSrc) copy(workerSrc, path.join(outDir, 'worker.min.js'));

// 2. WASM core - both SIMD and non-SIMD LSTM variants, since getCore.js
//    feature-detects the browser and picks whichever is supported.
const coreDir = (() => {
  const pkg = require_resolve_safe('tesseract.js-core/package.json');
  return pkg ? path.dirname(pkg) : null;
})();
if (coreDir) {
  ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm'].forEach((f) => {
    const src = path.join(coreDir, f);
    if (fs.existsSync(src)) copy(src, path.join(outDir, f));
  });
}

// 3. English language data
const langSrc = require_resolve_safe('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz');
if (langSrc) copy(langSrc, path.join(outDir, 'eng.traineddata.gz'));

console.log('[tesseract self-host] done.');
