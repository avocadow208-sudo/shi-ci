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

const OCR_START_TIMEOUT = 120_000;
const OCR_PAGE_TIMEOUT = 75_000;

function makeAbortError() {
  return new DOMException('扫描已取消', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw makeAbortError();
}

function guardTask(task, { signal, timeout, timeoutMessage, onStop }) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const stop = (error) => {
      try { onStop?.(); } catch { /* worker cleanup is best effort */ }
      finish(reject, error);
    };
    const abort = () => stop(makeAbortError());
    const timer = setTimeout(() => stop(new Error(timeoutMessage)), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    task.then((value) => finish(resolve, value), (error) => finish(reject, error));
    if (signal?.aborted) abort();
  });
}

async function renderPage(page) {
  const original = page.getViewport({ scale: 1 });
  // Around 1,250 px wide is enough for this textbook while avoiding multi-megapixel canvases.
  const scale = Math.min(2.15, 1250 / original.width);
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

function describeOcrStatus(message) {
  if (message.status === 'loading tesseract core') return '正在加载 OCR 引擎';
  if (message.status === 'loading language traineddata') return '正在加载中英文模型';
  if (message.status === 'initializing tesseract' || message.status === 'initializing api') return '正在初始化识别器';
  if (message.status === 'recognizing text') return '正在识别扫描页';
  return '正在准备 OCR';
}

async function createOcrWorker(onProgress, signal) {
  let workerPromise;
  workerPromise = createWorker(['eng', 'chi_sim'], OEM.LSTM_ONLY, {
    workerPath: assetUrl('ocr/worker.min.js'),
    corePath: assetUrl('ocr/core'),
    langPath: assetUrl('ocr/lang'),
    logger: (message) => onProgress?.({
      phase: describeOcrStatus(message),
      progress: message.progress || 0,
    }),
  });
  const worker = await guardTask(workerPromise, {
    signal,
    timeout: OCR_START_TIMEOUT,
    timeoutMessage: 'OCR 模型加载超时，请刷新页面并检查网络后重试。',
    onStop: () => workerPromise.then((pendingWorker) => pendingWorker.terminate()).catch(() => {}),
  });
  await worker.setParameters({
    // AUTO detects the two textbook columns in one pass and is much faster than two separate jobs.
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
    user_defined_dpi: '180',
  });
  return worker;
}

export async function readPdf(file, onProgress, signal) {
  throwIfAborted(signal);
  const data = await file.arrayBuffer();
  throwIfAborted(signal);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let worker = null;
  let currentOcrPage = 1;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let pageText = groupPdfItems(content.items, viewport);
      const hasUsefulText = pageText.length > 80 && /[\u3400-\u9fff]/.test(pageText) && /[A-Za-z]/.test(pageText);

      if (!hasUsefulText) {
        currentOcrPage = pageNumber;
        onProgress?.({ phase: '准备 OCR', page: pageNumber, total: pdf.numPages, progress: 0 });
        if (!worker) worker = await createOcrWorker((workerProgress) => {
          // The worker logger lives for the whole document, so read a mutable page number.
          onProgress?.({ ...workerProgress, page: currentOcrPage, total: pdf.numPages });
        }, signal);
        onProgress?.({ phase: '正在渲染扫描页', page: pageNumber, total: pdf.numPages, progress: 0 });
        const canvas = await renderPage(page);
        throwIfAborted(signal);
        const marginX = Math.round(canvas.width * 0.035);
        const marginY = Math.round(canvas.height * 0.035);
        const recognition = await guardTask(worker.recognize(canvas, {
          rectangle: {
            left: marginX,
            top: marginY,
            width: canvas.width - marginX * 2,
            height: canvas.height - marginY * 2,
          },
        }), {
          signal,
          timeout: OCR_PAGE_TIMEOUT,
          timeoutMessage: `第 ${pageNumber} 页识别超时，请降低文件分辨率后重试。`,
          onStop: () => worker?.terminate(),
        });
        pageText = recognition.data.text;
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

export async function readVocabularyFile(file, onProgress, signal) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return readPdf(file, onProgress, signal);
  if (name.endsWith('.docx') || name.endsWith('.doc')) return readDocx(file);
  throw new Error('请选择 PDF 或 Word（.docx）文件。');
}
