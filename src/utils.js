// Utility functions for Pomodoro Timer

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function secondsToMinutes(seconds) {
    return Math.floor(seconds / 60);
}

export function minutesToSeconds(minutes) {
    return minutes * 60;
}

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
