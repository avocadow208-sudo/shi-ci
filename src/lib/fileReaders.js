import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth/mammoth.browser';
import { createWorker, OEM, PSM } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function assetUrl(path) {
  return new URL(path, document.baseURI).href.replace(/\/$/, '');
}

function groupPdfItems(items, viewport) {
  const usable = items
    .filter((item) => item.str?.trim())
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }));

  const columns = [[], []];
  for (const item of usable) columns[item.x > viewport.width * 0.5 ? 1 : 0].push(item);

  return columns.flatMap((column) => {
    column.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const item of column) {
      const last = lines.at(-1);
      if (last && Math.abs(last.y - item.y) < 4.5) last.items.push(item);
      else lines.push({ y: item.y, items: [item] });
    }
    return lines.map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '));
  }).join('\n');
}

async function renderPage(page, scale = 2.65) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

function cropColumn(source, side) {
  const canvas = document.createElement('canvas');
  const marginX = Math.round(source.width * 0.06);
  const top = Math.round(source.height * 0.065);
  const bottom = Math.round(source.height * 0.04);
  const gap = Math.round(source.width * 0.012);
  const half = Math.round(source.width / 2);
  const sx = side === 0 ? marginX : half + gap;
  const width = side === 0 ? half - marginX - gap : source.width - sx - marginX;
  const height = source.height - top - bottom;
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d', { alpha: false }).drawImage(source, sx, top, width, height, 0, 0, width, height);
  return canvas;
}

async function createOcrWorker(onProgress) {
  const worker = await createWorker(['eng', 'chi_sim'], OEM.LSTM_ONLY, {
    workerPath: assetUrl('ocr/worker.min.js'),
    corePath: assetUrl('ocr/core'),
    langPath: assetUrl('ocr/lang'),
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress?.(message.progress || 0);
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  return worker;
}

export async function readPdf(file, onProgress) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let worker = null;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let pageText = groupPdfItems(content.items, viewport);
      const hasUsefulText = pageText.length > 80 && /[\u3400-\u9fff]/.test(pageText) && /[A-Za-z]/.test(pageText);

      if (!hasUsefulText) {
        onProgress?.({ phase: '准备 OCR', page: pageNumber, total: pdf.numPages, progress: 0 });
        if (!worker) worker = await createOcrWorker((progress) => {
          onProgress?.({ phase: '正在识别扫描页', page: pageNumber, total: pdf.numPages, progress });
        });
        const canvas = await renderPage(page);
        const left = await worker.recognize(cropColumn(canvas, 0));
        const right = await worker.recognize(cropColumn(canvas, 1));
        pageText = `${left.data.text}\n${right.data.text}`;
        canvas.width = 1;
        canvas.height = 1;
      }

      pages.push(pageText);
      onProgress?.({ phase: hasUsefulText ? '读取文字' : '完成扫描页', page: pageNumber, total: pdf.numPages, progress: 1 });
      page.cleanup();
    }
  } finally {
    if (worker) await worker.terminate();
    await pdf.destroy();
  }
  return pages.join('\n');
}

export async function readDocx(file) {
  if (file.name.toLowerCase().endsWith('.doc')) {
    throw new Error('暂不支持旧版 .doc，请先在 Word 中另存为 .docx。');
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function readVocabularyFile(file, onProgress) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return readPdf(file, onProgress);
  if (name.endsWith('.docx') || name.endsWith('.doc')) return readDocx(file);
  throw new Error('请选择 PDF 或 Word（.docx）文件。');
}
