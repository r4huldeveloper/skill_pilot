/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

import { San } from './sanitize.js';

/**
 * PDF extraction utility decoupled from the UI.
 */
const MAX_PDF_SIZE = 5 * 1024 * 1024;
const PDF_MIN_CHARS = 80;
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let workerReady = false;

function initWorker() {
  if (!workerReady && typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    workerReady = true;
  }
}

export const PDF = {
  async extractText(file) {
    if (!file || file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported.');
    }
    if (file.size > MAX_PDF_SIZE) {
      throw new Error('File exceeds 5 MB limit.');
    }

    initWorker();
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library not loaded.');
    }

    try {
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const pg = await pdf.getPage(p);
        const c = await pg.getTextContent();
        text += c.items.map(i => i.str).join(' ') + '\n';
      }
      text = San.text(text.replace(/\s+/g, ' '));
      if (text.length < PDF_MIN_CHARS) {
        throw new Error('Could not extract sufficient text. The PDF might be scanned.');
      }
      return { text, pageCount: pdf.numPages, fileName: file.name };
    } catch (e) {
      console.error('[PDF Extraction Error]', e);
      throw e;
    }
  }
};
