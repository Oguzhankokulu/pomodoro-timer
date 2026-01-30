// Utility functions for Pomodoro Timer

/**
 *
 * @param {number} seconds
 */
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 *
 * @param {number} seconds
 */
export function secondsToMinutes(seconds) {
    return Math.floor(seconds / 60);
}

/**
 *
 * @param {number} minutes
 */
export function minutesToSeconds(minutes) {
    return minutes * 60;
}

/**
 *
 * @param {string} intervalType
 */
export function getIntervalDisplayName(intervalType) {
    switch (intervalType) {
    case 'work':
        return 'Work';
    case 'short-break':
        return 'Short Break';
    case 'long-break':
        return 'Long Break';
    default:
        return 'Unknown';
    }
}
