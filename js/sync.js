/**
 * Beamer Presenter - Window Sync Module
 * Handles communication between presenter and audience windows
 */

import { CONFIG, AppState } from './config.js';

/**
 * Open audience window
 * @returns {Window|null}
 */
export function openAudienceWindow() {
    const width = Math.min(window.screen.width * 0.6, 1200);
    const height = Math.min(window.screen.height * 0.7, 800);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const features = `width=${width},height=${height},left=${left},top=${top}`;

    AppState.audienceWindow = window.open('audience.html', 'BeamerAudience', features);

    if (AppState.audienceWindow) {
        console.log('Audience window opened');
        return AppState.audienceWindow;
    } else {
        console.error('Failed to open audience window (popup blocked?)');
        return null;
    }
}

/**
 * Check if audience window is connected
 * @returns {boolean}
 */
export function isAudienceConnected() {
    return AppState.audienceWindow && !AppState.audienceWindow.closed && AppState.isAudienceConnected;
}

/**
 * Send message to audience window
 * @param {string} type - Message type
 * @param {object} payload - Message payload
 * @param {Transferable[]} [transfer] - Transferable objects
 */
export function sendToAudience(type, payload, transfer = []) {
    if (!AppState.audienceWindow || AppState.audienceWindow.closed) {
        console.log('Audience window not available');
        return;
    }

    const message = {
        sessionId: CONFIG.sessionId,
        type: type,
        payload: payload,
    };

    try {
        AppState.audienceWindow.postMessage(message, '*', transfer);
    } catch (error) {
        console.error('Failed to send message to audience:', error);
    }
}

/**
 * Send current state to audience
 */
export function sendStateToAudience() {
    sendToAudience(CONFIG.messageTypes.STATE, {
        page: AppState.currentPage,
        totalPages: AppState.totalPages,
        location: AppState.location,
        split: AppState.split,
        mode: AppState.displayMode,
    });
}

/**
 * Send navigation update to audience
 * @param {number} page - New page number
 */
export function sendNavigateToAudience(page) {
    sendToAudience(CONFIG.messageTypes.NAVIGATE, {
        page: page,
    });
}

/**
 * Send display mode update to audience
 * @param {string} mode - Display mode (normal, black, white)
 */
export function sendModeToAudience(mode) {
    sendToAudience(CONFIG.messageTypes.MODE, {
        mode: mode,
    });
}

/**
 * Send PDF data to audience
 */
export function sendPdfDataToAudience() {
    if (!AppState.pdfData) {
        console.log('No PDF data to send');
        return;
    }

    // Clone the ArrayBuffer for transfer
    const dataClone = AppState.pdfData.slice(0);

    sendToAudience(CONFIG.messageTypes.PDF_DATA, {
        data: dataClone,
        location: AppState.location,
        split: AppState.split,
    }, [dataClone]);
}

/**
 * Handle incoming message from audience
 * @param {MessageEvent} event
 * @param {Function} onConnect - Callback when audience connects
 */
export function handleAudienceMessage(event, onConnect) {
    const { sessionId, type, payload } = event.data || {};

    // Skip non-valid messages
    if (!type) {
        return;
    }

    console.log('Presenter received message:', type);

    switch (type) {
        case CONFIG.messageTypes.HELLO:
            console.log('Audience connected');
            AppState.isAudienceConnected = true;

            // Send current state and PDF data
            sendStateToAudience();

            if (AppState.pdfData) {
                console.log('Sending PDF data to audience, size:', AppState.pdfData.byteLength);
                sendPdfDataToAudience();
            }

            if (onConnect) {
                onConnect();
            }
            break;

        case CONFIG.messageTypes.ERROR:
            console.error('Error from audience:', payload);
            break;
    }
}

/**
 * Setup message listener for presenter
 * @param {Function} onConnect - Callback when audience connects
 */
export function setupPresenterMessageListener(onConnect) {
    window.addEventListener('message', (event) => {
        handleAudienceMessage(event, onConnect);
    });
}

// ============================================
// Audience-side functions
// ============================================

/**
 * Send hello message to presenter (called from audience)
 * @param {Window} presenterWindow - Presenter window reference (opener)
 */
export function sendHelloToPresenter(presenterWindow) {
    if (!presenterWindow || presenterWindow.closed) {
        console.error('Presenter window not available');
        return;
    }

    const message = {
        sessionId: CONFIG.sessionId,
        type: CONFIG.messageTypes.HELLO,
        payload: {},
    };

    presenterWindow.postMessage(message, '*');
}

/**
 * Handle incoming message from presenter (called from audience)
 * @param {MessageEvent} event
 * @param {object} callbacks - Event callbacks
 */
export function handlePresenterMessage(event, callbacks) {
    const { sessionId, type, payload } = event.data || {};

    // Store session ID from first message
    if (!CONFIG.sessionId && sessionId) {
        CONFIG.sessionId = sessionId;
    }

    switch (type) {
        case CONFIG.messageTypes.STATE:
            console.log('Received state:', payload);
            if (callbacks.onState) {
                callbacks.onState(payload);
            }
            break;

        case CONFIG.messageTypes.NAVIGATE:
            console.log('Received navigate:', payload);
            if (callbacks.onNavigate) {
                callbacks.onNavigate(payload.page);
            }
            break;

        case CONFIG.messageTypes.MODE:
            console.log('Received mode:', payload);
            if (callbacks.onMode) {
                callbacks.onMode(payload.mode);
            }
            break;

        case CONFIG.messageTypes.PDF_DATA:
            console.log('Received PDF data');
            if (callbacks.onPdfData) {
                callbacks.onPdfData(payload.data, payload.location, payload.split);
            }
            break;
    }
}

/**
 * Setup message listener for audience
 * @param {object} callbacks - Event callbacks
 */
export function setupAudienceMessageListener(callbacks) {
    window.addEventListener('message', (event) => {
        handlePresenterMessage(event, callbacks);
    });
}
