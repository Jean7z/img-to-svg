const $ = (id) => document.getElementById(id);
const MAX_SIDE = 4096; // ponytail: capa de canvas para no congelar pestañas, sube si hace falta

const el = {
  drop: $('drop'), file: $('file'), fname: $('fname'),
  btnConvert: $('btnConvert'), btnDownload: $('btnDownload'), btnCopy: $('btnCopy'),
  status: $('status'), stats: $('stats'), cli: $('cli'),
  origStage: $('origStage'), svgStage: $('svgStage'),
  origMeta: $('origMeta'), svgMeta: $('svgMeta'),
  cp: $('cp'), fs: $('fs'), ld: $('ld'), pp: $('pp'), opt: $('opt'),
  ct: $('ct'), st: $('st'), rowCt: $('rowCt'), rowSt: $('rowSt'),
};
const vals = { cp: $('cpV'), fs: $('fsV'), ld: $('ldV'), pp: $('ppV'), opt: $('optV'), ct: $('ctV'), st: $('stV') };

let worker = null;
let img = null;          // ImageBitmap
let width = 0, height = 0;
let fileName = '';
let svg = null;
let jobId = 0;
let convertTimer = null;

function status(msg, cls) {
  el.status.textContent = msg;
  el.status.className = cls || '';
}

function mb(n) {
  return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
}

function pathCount(svgStr) {
  const m = svgStr.match(/<path\b/gi);
  return m ? m.length : 0;
}

// ---------- opciones y CLI ----------
function readOptions() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  const o = {
    mode,
    hierarchical: document.querySelector('input[name=hierarchical]:checked').value,
    filterSpeckle: +el.fs.value,
    colorPrecision: +el.cp.value,
    layerDifference: +el.ld.value,
    pathPrecision: +el.pp.value,
    optimize: +el.opt.value,
  };
  if (mode !== 'pixel') {
    o.cornerThreshold = +el.ct.value;
    o.spliceThreshold = +el.st.value;
  }
  return o;
}

function cliCommand() {
  const o = readOptions();
  const a = ['vtracer', fileName || 'input.png', 'output.svg',
    '--colormode color',
    '--hierarchical ' + o.hierarchical,
    '--mode ' + o.mode,
    '--filter_speckle ' + o.filterSpeckle,
    '--color_precision ' + o.colorPrecision,
    '--path_precision ' + o.pathPrecision,
  ];
  if (o.layerDifference !== 16) a.push('--gradient_step ' + o.layerDifference);
  if (o.mode !== 'pixel') {
    if (o.cornerThreshold !== 60) a.push('--corner_threshold ' + o.cornerThreshold);
    if (o.spliceThreshold !== 45) a.push('--splice_threshold ' + o.spliceThreshold);
  }
  if (o.optimize === 0) a.push('--optimize 0');
  return a.join(' ');
}

function updateModeRows() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  el.rowCt.style.display = el.rowSt.style.display = mode === 'pixel' ? 'none' : '';
}

function syncVal(name) {
  const v = el[name].value;
  vals[name].textContent = name === 'opt' ? (v === '1' ? 'Sí' : 'No') : v;
  el.cli.textContent = cliCommand();
  schedule();
}

// ---------- worker ----------
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => onDone(e.data);
    worker.onerror = (e) => {
      status('Error del worker: ' + e.message, 'err');
      worker = null;
    };
  }
  return worker;
}

function onDone(data) {
  if (data.id !== jobId) return; // respuesta de un job viejo
  if (!data.ok) { status('Error: ' + data.error, 'err'); return; }
  svg = data.svg;
  const urls = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  el.svgStage.innerHTML = '';
  const im = new Image();
  im.onload = () => URL.revokeObjectURL(urls);
  im.src = urls;
  el.svgStage.appendChild(im);
  el.svgMeta.textContent = pathCount(svg) + ' paths';
  el.stats.innerHTML =
    `<span>paths <b>${pathCount(svg)}</b></span>` +
    `<span>tama&ntilde;o <b>${mb(new Blob([svg]).size)}</b></span>` +
    `<span>${width}&times;${height}px</span>`;
  el.btnDownload.disabled = false;
  status('Listo', 'ok');
}

function schedule() {
  if (!img) return;
  if (!el.btnConvert.disabled) return; // ya hay un job en vuelo
  clearTimeout(convertTimer);
  convertTimer = setTimeout(convert, 400);
}

function convert() {
  if (!img) return;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  jobId++;
  el.btnConvert.disabled = true;
  status('Vectorizando…', 'busy');
  getWorker().postMessage({
    id: jobId,
    pixels: data.buffer, // transferable; data ya no se usa después
    width, height,
    options: readOptions(),
  }, [data.buffer]);
}

// ---------- carga de imagen ----------
async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  fileName = file.name.replace(/\.[^.]+$/, '');
  img = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  width = Math.round(img.width * scale);
  height = Math.round(img.height * scale);
  if (scale < 1) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    c.getContext('2d').drawImage(img, 0, 0, width, height);
    img.close();
    img = await createImageBitmap(c);
  }
  el.fname.textContent = file.name + (scale < 1 ? ` (redimensionada a ${width}×${height}px por el límite de ${MAX_SIDE}px)` : '');
  el.origStage.innerHTML = '';
  const im = new Image();
  im.src = URL.createObjectURL(file);
  el.origStage.appendChild(im);
  el.origMeta.textContent = `${file.name} · ${width}×${height}px`;
  el.btnConvert.disabled = false;
  el.btnDownload.disabled = true;
  svg = null;
  el.svgStage.innerHTML = '<span class="placeholder">Esperando&hellip;</span>';
  el.svgMeta.textContent = '';
  el.stats.innerHTML = '';
  el.cli.textContent = cliCommand();
  status('Imagen lista. Ajusta parámetros o convierte.', '');
  convert(); // convierte inmediatamente con los valores por defecto
}

el.file.addEventListener('change', () => loadFile(el.file.files[0]));
el.drop.addEventListener('click', () => el.file.click());
el.drop.addEventListener('dragover', (e) => { e.preventDefault(); el.drop.classList.add('over'); });
el.drop.addEventListener('dragleave', () => el.drop.classList.remove('over'));
el.drop.addEventListener('drop', (e) => {
  e.preventDefault();
  el.drop.classList.remove('over');
  loadFile(e.dataTransfer.files[0]);
});

el.btnConvert.addEventListener('click', () => { clearTimeout(convertTimer); convert(); });
el.btnDownload.addEventListener('click', () => {
  if (!svg) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  a.download = fileName + '.svg';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
el.btnCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.cli.textContent);
    el.btnCopy.textContent = 'Copiado';
    setTimeout(() => (el.btnCopy.textContent = 'Copiar comando'), 1200);
  } catch {
    el.btnCopy.textContent = 'No se pudo copiar';
  }
});

['cp', 'fs', 'ld', 'pp', 'opt', 'ct', 'st'].forEach((n) => {
  el[n].addEventListener('input', () => syncVal(n));
});
document.querySelectorAll('input[name=mode]').forEach((r) =>
  r.addEventListener('change', () => { updateModeRows(); el.cli.textContent = cliCommand(); schedule(); }));
document.querySelectorAll('input[name=hierarchical]').forEach((r) =>
  r.addEventListener('change', () => { el.cli.textContent = cliCommand(); schedule(); }));

updateModeRows();
el.cli.textContent = cliCommand();