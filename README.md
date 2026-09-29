# Imagen → SVG con vtracer

Convierte imágenes (PNG, JPG, WebP, GIF, BMP) a SVG vectorizado con el core
**vtracer 1.0** compilado a WebAssembly. Todo corre en tu navegador: las
imágenes nunca se suben a ningún servidor.

## Uso

Sirve la carpeta con cualquier servidor estático (los *module workers* no
funcionan con `file://`):

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Arrastra una imagen, ajusta los parámetros (por defecto: máxima fidelidad)
y descarga el SVG. El panel muestra el comando CLI equivalente.

## Archivos

- `index.html` + `app.js` — interfaz
- `worker.js` — web worker que corre la vectorización
- `vtracer.js` — glue ESM portado del paquete `@visioncortex/vtracer@1.0.0-alpha.4`
- `vtracer.wasm.b64.js` — wasm del core (668 KB) embebido en base64

## Fidelidad máxima

| Parámetro | Valor | Nota |
|---|---|---|
| `--mode` | `pixel` | no simplifica curvas |
| `--color_precision` | `8` | todos los bits RGB (core 1.0; el viejo visioncortex 0.8.8 crasheaba con 8) |
| `--filter_speckle` | `0` | conserva todo detalle |
| `--gradient_step` | `4` | más capas de gradiente (defecto CLI: 16) |
| `--path_precision` | `8` | igual que la CLI 0.6.5 |
| `--optimize` | `0` | colores exactos del original (flag de 1.0) |