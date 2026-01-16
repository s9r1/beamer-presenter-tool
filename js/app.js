/**
 * Beamer Presenter - Main Application
 * Entry point for presenter screen
 */

import { CONFIG, AppState } from './config.js';
import { initPdfJs, loadPdfFromBuffer, loadPdfFromUrl, renderAudienceSlide, renderNotesArea } from './pdf-renderer.js';
import { openAudienceWindow, sendNavigateToAudience, sendPointerToAudience, setupPresenterMessageListener, isAudienceConnected } from './sync.js';
import { startClock, startTimer, pauseTimer, resetTimer, toggleTimer, getTimerState } from './timer.js';

// DOM Elements
const elements = {
    // Start screen
    startScreen: null,
    dropZone: null,
    fileInput: null,
    urlInput: null,
    urlLoadBtn: null,
    locationSelect: null,
    advancedToggle: null,
    advancedContent: null,
    splitInput: null,
    scaleInput: null,
    nextPreviewCheckbox: null,

    // Presenter screen
    presenterScreen: null,
    homeBtn: null,
    pageCurrent: null,
    pageTotal: null,
    prevBtn: null,
    nextBtn: null,
    jumpInput: null,
    clockDisplay: null,
    timerDisplay: null,
    timerStartBtn: null,
    timerResetBtn: null,

    // Preview panels
    currentPreview: null,
    currentPreviewWrapper: null,
    presenterPointer: null,
    nextPreview: null,
    nextPreviewSection: null,
    notesCanvas: null,

    // Bottom bar
    connectionStatus: null,
    openAudienceBtn: null,
    fullscreenBtn: null,

    // Overlays
    loadingOverlay: null,
    toast: null,
};

/**
 * Initialize DOM element references
 */
function initElements() {
    // Start screen
    elements.startScreen = document.getElementById('start-screen');
    elements.dropZone = document.getElementById('drop-zone');
    elements.fileInput = document.getElementById('file-input');
    elements.urlInput = document.getElementById('url-input');
    elements.urlLoadBtn = document.getElementById('url-load-btn');
    elements.locationSelect = document.getElementById('location-select');
    elements.advancedToggle = document.getElementById('advanced-toggle');
    elements.advancedContent = document.getElementById('advanced-content');
    elements.splitInput = document.getElementById('split-input');
    elements.scaleInput = document.getElementById('scale-input');
    elements.nextPreviewCheckbox = document.getElementById('next-preview-checkbox');

    // Presenter screen
    elements.presenterScreen = document.getElementById('presenter-screen');
    elements.homeBtn = document.getElementById('home-btn');
    elements.pageCurrent = document.getElementById('page-current');
    elements.pageTotal = document.getElementById('page-total');
    elements.prevBtn = document.getElementById('prev-btn');
    elements.nextBtn = document.getElementById('next-btn');
    elements.jumpInput = document.getElementById('jump-input');
    elements.clockDisplay = document.getElementById('clock-display');
    elements.timerDisplay = document.getElementById('timer-display');
    elements.timerStartBtn = document.getElementById('timer-start-btn');
    elements.timerResetBtn = document.getElementById('timer-reset-btn');

    // Preview panels
    elements.currentPreview = document.getElementById('current-preview');
    elements.currentPreviewWrapper = document.getElementById('current-preview-wrapper');
    elements.presenterPointer = document.getElementById('presenter-pointer');
    elements.nextPreview = document.getElementById('next-preview');
    elements.nextPreviewSection = document.getElementById('next-preview-section');
    elements.notesCanvas = document.getElementById('notes-canvas');

    // Bottom bar
    elements.connectionStatus = document.getElementById('connection-status');
    elements.openAudienceBtn = document.getElementById('open-audience-btn');
    elements.fullscreenBtn = document.getElementById('fullscreen-btn');

    // Overlays
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.toast = document.getElementById('toast');
}

/**
 * Show toast notification
 * @param {string} message
 * @param {string} type - 'info', 'success', 'error'
 */
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

/**
 * Show/hide loading overlay
 * @param {boolean} show
 * @param {string} text
 */
function setLoading(show, text = 'Loading...') {
    if (show) {
        elements.loadingOverlay.querySelector('.loading-text').textContent = text;
        elements.loadingOverlay.classList.remove('hidden');
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
}

/**
 * Update page display
 */
function updatePageDisplay() {
    elements.pageCurrent.textContent = AppState.currentPage;
    elements.pageTotal.textContent = AppState.totalPages;

    // Update button states
    elements.prevBtn.disabled = AppState.currentPage <= 1;
    elements.nextBtn.disabled = AppState.currentPage >= AppState.totalPages;
}

/**
 * Update connection status display
 */
function updateConnectionStatus() {
    const connected = isAudienceConnected();

    elements.connectionStatus.textContent = connected ? 'Connected' : 'Not connected';
    elements.connectionStatus.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
    elements.openAudienceBtn.textContent = connected ? 'Reconnect' : 'Open Audience';
}

/**
 * Render current page
 */
async function renderCurrentPage() {
    const page = AppState.currentPage;

    try {
        // Render current slide preview
        await renderAudienceSlide(elements.currentPreview, page);

        // Render notes
        await renderNotesArea(elements.notesCanvas, page);

        // Render next preview if enabled
        if (AppState.showNextPreview && page < AppState.totalPages) {
            elements.nextPreviewSection.classList.remove('hidden');
            await renderAudienceSlide(elements.nextPreview, page + 1);
        } else {
            elements.nextPreviewSection.classList.add('hidden');
        }

        updatePageDisplay();
    } catch (error) {
        console.error('Render error:', error);
        showToast('Render error: ' + error.message, 'error');
    }
}

/**
 * Navigate to a specific page
 * @param {number} page
 */
async function navigateTo(page) {
    if (page < 1 || page > AppState.totalPages) {
        return;
    }

    AppState.currentPage = page;

    // Hide laser pointer on page change
    sendPointerToAudience(null, null, false);
    if (elements.presenterPointer) {
        elements.presenterPointer.classList.add('hidden');
    }

    await renderCurrentPage();

    // Notify audience
    sendNavigateToAudience(page);
}

/**
 * Go to next page
 */
async function nextPage() {
    await navigateTo(AppState.currentPage + 1);
}

/**
 * Go to previous page
 */
async function prevPage() {
    await navigateTo(AppState.currentPage - 1);
}

/**
 * Request fullscreen for audience window
 */
function requestAudienceFullscreen() {
    if (AppState.audienceWindow && !AppState.audienceWindow.closed) {
        AppState.audienceWindow.focus();
        // Send a message to request fullscreen (audience will handle it)
        AppState.audienceWindow.postMessage({
            sessionId: CONFIG.sessionId,
            type: 'REQUEST_FULLSCREEN',
        }, '*');
    }
}

/**
 * Handle file selection
 * @param {File} file
 */
async function handleFileSelect(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please select a PDF file', 'error');
        return;
    }

    setLoading(true, 'Loading PDF...');

    try {
        const arrayBuffer = await file.arrayBuffer();
        await loadPdfFromBuffer(arrayBuffer);

        // Apply settings
        AppState.location = elements.locationSelect.value;
        AppState.split = parseFloat(elements.splitInput.value) || 0.5;
        AppState.scale = parseFloat(elements.scaleInput.value) || 1.0;
        AppState.showNextPreview = elements.nextPreviewCheckbox.checked;

        // Switch to presenter screen
        elements.startScreen.classList.add('hidden');
        elements.presenterScreen.classList.add('active');

        // Start clock
        startClock(elements.clockDisplay);

        // Render first page
        await renderCurrentPage();

        showToast(`Loaded: ${file.name} (${AppState.totalPages} pages)`, 'success');
    } catch (error) {
        console.error('PDF load error:', error);
        showToast('Failed to load PDF: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Handle URL load
 */
async function handleUrlLoad() {
    const url = elements.urlInput.value.trim();

    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }

    setLoading(true, 'Loading PDF from URL...');

    try {
        await loadPdfFromUrl(url);

        // Apply settings
        AppState.location = elements.locationSelect.value;
        AppState.split = parseFloat(elements.splitInput.value) || 0.5;
        AppState.scale = parseFloat(elements.scaleInput.value) || 1.0;
        AppState.showNextPreview = elements.nextPreviewCheckbox.checked;

        // Switch to presenter screen
        elements.startScreen.classList.add('hidden');
        elements.presenterScreen.classList.add('active');

        // Start clock
        startClock(elements.clockDisplay);

        // Render first page
        await renderCurrentPage();

        showToast(`Loaded: ${url} (${AppState.totalPages} pages)`, 'success');
    } catch (error) {
        console.error('URL load error:', error);
        showToast('Failed to load PDF. Check URL and CORS settings.', 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT') {
            if (e.key === 'Enter' && e.target === elements.jumpInput) {
                const page = parseInt(elements.jumpInput.value, 10);
                if (!isNaN(page)) {
                    await navigateTo(page);
                    elements.jumpInput.value = '';
                }
            }
            return;
        }

        const shortcuts = CONFIG.shortcuts;

        if (shortcuts.next.includes(e.code)) {
            e.preventDefault();
            await nextPage();
        } else if (shortcuts.prev.includes(e.code)) {
            e.preventDefault();
            await prevPage();
        } else if (shortcuts.first.includes(e.code)) {
            e.preventDefault();
            await navigateTo(1);
        } else if (shortcuts.last.includes(e.code)) {
            e.preventDefault();
            await navigateTo(AppState.totalPages);
        } else if (shortcuts.fullscreen.includes(e.code)) {
            e.preventDefault();
            requestAudienceFullscreen();
        }
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // File input
    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    // Drop zone
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    // URL load
    elements.urlLoadBtn.addEventListener('click', handleUrlLoad);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUrlLoad();
        }
    });

    // Advanced settings toggle
    elements.advancedToggle.addEventListener('click', () => {
        elements.advancedToggle.classList.toggle('open');
        elements.advancedContent.classList.toggle('open');
    });

    // Home button (go back to start screen)
    elements.homeBtn.addEventListener('click', () => {
        if (confirm('Go back to home? Current presentation will be closed.')) {
            // Reset state
            AppState.pdfDoc = null;
            AppState.pdfData = null;
            AppState.pdfUrl = null;
            AppState.totalPages = 0;
            AppState.currentPage = 1;
            AppState.pageCache.clear();

            // Clear canvases
            const ctx1 = elements.currentPreview?.getContext('2d');
            const ctx2 = elements.nextPreview?.getContext('2d');
            const ctx3 = elements.notesCanvas?.getContext('2d');
            if (ctx1) ctx1.clearRect(0, 0, elements.currentPreview.width, elements.currentPreview.height);
            if (ctx2) ctx2.clearRect(0, 0, elements.nextPreview.width, elements.nextPreview.height);
            if (ctx3) ctx3.clearRect(0, 0, elements.notesCanvas.width, elements.notesCanvas.height);

            // Reset input fields
            elements.urlInput.value = '';
            elements.fileInput.value = '';

            // Switch screens
            elements.presenterScreen.classList.remove('active');
            elements.startScreen.classList.remove('hidden');
        }
    });

    // Navigation buttons
    elements.prevBtn.addEventListener('click', prevPage);
    elements.nextBtn.addEventListener('click', nextPage);

    // Timer controls
    elements.timerStartBtn.addEventListener('click', () => {
        toggleTimer(elements.timerDisplay);
        elements.timerStartBtn.textContent = getTimerState() === 'running' ? 'Pause' : 'Start';
    });

    elements.timerResetBtn.addEventListener('click', () => {
        resetTimer(elements.timerDisplay);
        elements.timerStartBtn.textContent = 'Start';
    });

    // Open audience window
    elements.openAudienceBtn.addEventListener('click', () => {
        openAudienceWindow();
        setTimeout(updateConnectionStatus, 1000);
    });

    // Fullscreen button
    elements.fullscreenBtn.addEventListener('click', requestAudienceFullscreen);

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup message listener for audience connection
    setupPresenterMessageListener(() => {
        updateConnectionStatus();
    });

    // Periodic connection check
    setInterval(updateConnectionStatus, 2000);

    // Laser pointer functionality
    let isPointerActive = false;
    let lastPointerSendTime = 0;
    const POINTER_THROTTLE_MS = 33; // ~30fps

    /**
     * Calculate normalized pointer coordinates
     * @param {MouseEvent} e - Mouse event
     * @returns {{x: number, y: number}|null} - Normalized coordinates or null if outside canvas
     */
    function getPointerCoords(e) {
        const canvas = elements.currentPreview;
        const canvasRect = canvas.getBoundingClientRect();

        // Calculate position relative to canvas
        const x = (e.clientX - canvasRect.left) / canvasRect.width;
        const y = (e.clientY - canvasRect.top) / canvasRect.height;

        // Clamp to 0-1 range
        if (x < 0 || x > 1 || y < 0 || y > 1) {
            return null;
        }

        return { x, y };
    }

    /**
     * Update presenter pointer position
     */
    function updatePresenterPointer(x, y, active) {
        if (!active || x === null || y === null) {
            elements.presenterPointer.classList.add('hidden');
            return;
        }

        elements.presenterPointer.classList.remove('hidden');

        const canvas = elements.currentPreview;
        const canvasRect = canvas.getBoundingClientRect();
        const wrapperRect = elements.currentPreviewWrapper.getBoundingClientRect();

        // Calculate offset of canvas within wrapper
        const offsetX = canvasRect.left - wrapperRect.left;
        const offsetY = canvasRect.top - wrapperRect.top;

        // Calculate position in pixels
        const posX = offsetX + (x * canvasRect.width);
        const posY = offsetY + (y * canvasRect.height);

        elements.presenterPointer.style.left = `${posX}px`;
        elements.presenterPointer.style.top = `${posY}px`;
    }

    /**
     * Send pointer position with throttling
     */
    function sendPointerThrottled(x, y, active) {
        const now = Date.now();
        if (now - lastPointerSendTime >= POINTER_THROTTLE_MS) {
            sendPointerToAudience(x, y, active);
            lastPointerSendTime = now;
        }
    }

    // Mouse down - start showing pointer
    elements.currentPreviewWrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        isPointerActive = true;

        const coords = getPointerCoords(e);
        if (coords) {
            updatePresenterPointer(coords.x, coords.y, true);
            sendPointerToAudience(coords.x, coords.y, true);
        }
    });

    // Mouse move - update pointer position
    elements.currentPreviewWrapper.addEventListener('mousemove', (e) => {
        if (!isPointerActive) return;

        const coords = getPointerCoords(e);
        if (coords) {
            updatePresenterPointer(coords.x, coords.y, true);
            sendPointerThrottled(coords.x, coords.y, true);
        } else {
            // Outside canvas bounds
            updatePresenterPointer(null, null, false);
            sendPointerToAudience(null, null, false);
        }
    });

    // Mouse up - hide pointer
    elements.currentPreviewWrapper.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;
        isPointerActive = false;
        updatePresenterPointer(null, null, false);
        sendPointerToAudience(null, null, false);
    });

    // Mouse leave - hide pointer
    elements.currentPreviewWrapper.addEventListener('mouseleave', () => {
        if (isPointerActive) {
            isPointerActive = false;
            updatePresenterPointer(null, null, false);
            sendPointerToAudience(null, null, false);
        }
    });
}

/**
 * Initialize application
 */
async function init() {
    console.log('Beamer Presenter initializing...');

    initElements();

    // Initialize PDF.js
    const pdfReady = await initPdfJs();
    if (!pdfReady) {
        showToast('Failed to initialize PDF.js', 'error');
    }

    setupEventListeners();

    console.log('Beamer Presenter ready');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
