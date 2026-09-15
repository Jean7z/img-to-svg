// Web Worker: vectoriza con el core WASM de vtracer 1.0.
// El import de vtracer.js instancia el wasm (base64 embebido) en el momento de cargar el módulo.
import { vectorize_rgba } from './vtracer.js';

self.onmessage = (e) => {
  const { id, pixels, width, height, options } = e.data;
  try {
    // pixels llega como ArrayBuffer transferido; el glue wasm exige Uint8Array
    const svg = vectorize_rgba(new Uint8Array(pixels), width, height, options);
    self.postMessage({ id, ok: true, svg });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};