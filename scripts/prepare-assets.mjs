import { copyFile, mkdir } from "node:fs/promises";
await mkdir("public/ocr", { recursive: true });
for (const [source, target] of [
  [
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    "public/pdf.worker.min.mjs",
  ],
  ["node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js"],
  [
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
    "public/ocr/tesseract-core-lstm.wasm.js",
  ],
  [
    "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "public/ocr/eng.traineddata.gz",
  ],
])
  await copyFile(source, target);
console.log("Prepared self-hosted PDF and OCR assets.");
