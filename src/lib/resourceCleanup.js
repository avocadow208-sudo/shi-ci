async function safeMethod(target, method) {
  if (typeof target?.[method] !== 'function') return;
  try {
    await target[method]();
  } catch {
    // Cleanup must never discard successfully extracted vocabulary.
  }
}

export async function cleanupPdfResources({ ocrWorker, pdf, loadingTask }) {
  await safeMethod(ocrWorker, 'terminate');
  await safeMethod(pdf, 'cleanup');
  await safeMethod(loadingTask, 'destroy');
}

