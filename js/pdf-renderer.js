/**
 * Beamer Presenter - PDF Renderer Module
 * Handles PDF loading and rendering using PDF.js
 */

import { AppState, getRegions } from './config.js';

// PDF.js will be loaded globally from vendor
let pdfjsLib = null;

/**
 * Initialize PDF.js library
 * Handles file:// protocol fallback
 */
export async function initPdfJs() {
    // Try to use ES module import
    try {
        // For file:// protocol, we need to handle worker specially
        const isFileProtocol = window.location.protocol === 'file:';

        // Load PDF.js from vendor
        pdfjsLib = window.pdfjsLib;

        if (!pdfjsLib) {
            throw new Error('PDF.js not loaded');
        }

        // Configure worker
        if (isFileProtocol) {
            // Disable worker for file:// protocol (fallback)
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            console.log('PDF.js: Worker disabled for file:// protocol');
        } else {
            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';
        }

        console.log('PDF.js initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize PDF.js:', error);

        // Fallback: disable worker
        if (pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            console.log('PDF.js: Falling back to no-worker mode');
            return true;
        }

        return false;
    }
}

/**
 * Load PDF from ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer - PDF data
 * @returns {Promise<PDFDocumentProxy>}
 */
export async function loadPdfFromBuffer(arrayBuffer) {
    if (!pdfjsLib) {
        throw new Error('PDF.js not initialized');
    }

    // Store for sharing with audience
    AppState.pdfData = arrayBuffer.slice(0);

    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableAutoFetch: true,
        disableStream: true,
    });

    const pdfDoc = await loadingTask.promise;

    AppState.pdfDoc = pdfDoc;
    AppState.totalPages = pdfDoc.numPages;
    AppState.currentPage = 1;
    AppState.pageCache.clear();

    console.log(`PDF loaded: ${pdfDoc.numPages} pages`);

    return pdfDoc;
}

/**
 * Load PDF from URL
 * @param {string} url - PDF URL
 * @returns {Promise<PDFDocumentProxy>}
 */
export async function loadPdfFromUrl(url) {
    if (!pdfjsLib) {
        throw new Error('PDF.js not initialized');
    }

    // Fetch PDF as ArrayBuffer so we can share with audience
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Store for sharing with audience
    AppState.pdfData = arrayBuffer.slice(0);
    AppState.pdfUrl = url;

    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableAutoFetch: true,
        disableStream: true,
    });

    const pdfDoc = await loadingTask.promise;

    AppState.pdfDoc = pdfDoc;
    AppState.totalPages = pdfDoc.numPages;
    AppState.currentPage = 1;
    AppState.pageCache.clear();

    console.log(`PDF loaded from URL: ${pdfDoc.numPages} pages`);

    return pdfDoc;
}

/**
 * Render a full page to an offscreen canvas
 * @param {number} pageNum - Page number (1-indexed)
 * @param {number} scale - Render scale
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderFullPage(pageNum, scale = 1.0) {
    if (!AppState.pdfDoc) {
        throw new Error('No PDF loaded');
    }

    const cacheKey = `${pageNum}-${scale}`;
    if (AppState.pageCache.has(cacheKey)) {
        return AppState.pageCache.get(cacheKey);
    }

    const page = await AppState.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale * window.devicePixelRatio });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
        canvasContext: context,
        viewport: viewport,
    }).promise;

    // Cache the result (limit cache size)
    if (AppState.pageCache.size > 5) {
        const firstKey = AppState.pageCache.keys().next().value;
        AppState.pageCache.delete(firstKey);
    }
    AppState.pageCache.set(cacheKey, canvas);

    return canvas;
}

/**
 * Extract a region from a canvas and draw to target
 * @param {HTMLCanvasElement} source - Source canvas
 * @param {HTMLCanvasElement} target - Target canvas
 * @param {{ x: number, y: number, w: number, h: number }} region - Region to extract
 */
export function extractRegion(source, target, region) {
    const ctx = target.getContext('2d');

    // Calculate target dimensions maintaining aspect ratio
    const aspectRatio = region.w / region.h;
    let targetWidth = target.width;
    let targetHeight = target.height;

    // Clear target
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Draw the region to target
    ctx.drawImage(
        source,
        region.x, region.y, region.w, region.h,  // Source region
        0, 0, targetWidth, targetHeight           // Target area
    );
}

/**
 * Render audience slide to a canvas
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {number} pageNum - Page number (1-indexed)
 */
export async function renderAudienceSlide(canvas, pageNum) {
    if (!AppState.pdfDoc || pageNum < 1 || pageNum > AppState.totalPages) {
        return;
    }

    const scale = AppState.scale;
    const fullPage = await renderFullPage(pageNum, scale);

    const regions = getRegions(
        fullPage.width,
        fullPage.height,
        AppState.location,
        AppState.split
    );

    // Resize canvas to match aspect ratio
    const region = regions.audience;
    const aspectRatio = region.w / region.h;

    // Use devicePixelRatio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.parentElement?.clientWidth || 400;
    const displayHeight = displayWidth / aspectRatio;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    extractRegion(fullPage, canvas, region);
}

/**
 * Render notes area to a canvas
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {number} pageNum - Page number (1-indexed)
 */
export async function renderNotesArea(canvas, pageNum) {
    if (!AppState.pdfDoc || pageNum < 1 || pageNum > AppState.totalPages) {
        return;
    }

    const scale = AppState.scale * 1.5; // Higher scale for notes
    const fullPage = await renderFullPage(pageNum, scale);

    const regions = getRegions(
        fullPage.width,
        fullPage.height,
        AppState.location,
        AppState.split
    );

    // Resize canvas to match aspect ratio
    const region = regions.notes;
    const aspectRatio = region.w / region.h;

    // Use devicePixelRatio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const maxWidth = container?.clientWidth || 800;
    const maxHeight = container?.clientHeight || 600;

    let displayWidth = maxWidth;
    let displayHeight = displayWidth / aspectRatio;

    if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight * aspectRatio;
    }

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.width = displayWidth * dpr * 1.5; // Higher resolution
    canvas.height = displayHeight * dpr * 1.5; // Higher resolution

    extractRegion(fullPage, canvas, region);
}
