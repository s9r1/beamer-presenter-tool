/**
 * Beamer Presenter - Timer Module
 * Handles clock and elapsed timer functionality
 */

import { AppState } from './config.js';

let clockInterval = null;
let timerInterval = null;

/**
 * Format time as HH:MM:SS
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

/**
 * Format current time as HH:MM:SS
 * @returns {string}
 */
export function getCurrentTime() {
    const now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

/**
 * Start the clock display
 * @param {HTMLElement} element - Element to display clock
 */
export function startClock(element) {
    if (clockInterval) {
        clearInterval(clockInterval);
    }

    const update = () => {
        element.textContent = getCurrentTime();
    };

    update();
    clockInterval = setInterval(update, 1000);
}

/**
 * Stop the clock display
 */
export function stopClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

/**
 * Get elapsed time in milliseconds
 * @returns {number}
 */
export function getElapsedTime() {
    if (AppState.timerState === 'stopped') {
        return 0;
    }

    if (AppState.timerState === 'paused') {
        return AppState.timerElapsed;
    }

    // Running
    return AppState.timerElapsed + (Date.now() - AppState.timerStartTime);
}

/**
 * Update timer display
 * @param {HTMLElement} element - Element to display timer
 */
function updateTimerDisplay(element) {
    element.textContent = formatTime(getElapsedTime());
}

/**
 * Start the elapsed timer
 * @param {HTMLElement} element - Element to display timer
 */
export function startTimer(element) {
    if (AppState.timerState === 'running') {
        return;
    }

    if (AppState.timerState === 'stopped') {
        AppState.timerElapsed = 0;
    }

    AppState.timerStartTime = Date.now();
    AppState.timerState = 'running';

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => updateTimerDisplay(element), 1000);
    updateTimerDisplay(element);
}

/**
 * Pause the elapsed timer
 * @param {HTMLElement} element - Element to display timer
 */
export function pauseTimer(element) {
    if (AppState.timerState !== 'running') {
        return;
    }

    AppState.timerElapsed = getElapsedTime();
    AppState.timerState = 'paused';

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    updateTimerDisplay(element);
}

/**
 * Reset the elapsed timer
 * @param {HTMLElement} element - Element to display timer
 */
export function resetTimer(element) {
    AppState.timerState = 'stopped';
    AppState.timerStartTime = null;
    AppState.timerElapsed = 0;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    element.textContent = '00:00:00';
}

/**
 * Toggle timer (start/pause)
 * @param {HTMLElement} element - Element to display timer
 */
export function toggleTimer(element) {
    if (AppState.timerState === 'running') {
        pauseTimer(element);
    } else {
        startTimer(element);
    }
}

/**
 * Get timer state
 * @returns {string} - 'stopped', 'running', or 'paused'
 */
export function getTimerState() {
    return AppState.timerState;
}
