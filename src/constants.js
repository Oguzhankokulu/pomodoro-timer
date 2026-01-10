// Constants for Pomodoro Timer

export const TimerState = Object.freeze({
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
});

export const IntervalType = Object.freeze({
    WORK: 'work',
    SHORT_BREAK: 'short-break',
    LONG_BREAK: 'long-break',
});

export const DefaultDurations = Object.freeze({
    WORK: 1500,
    SHORT_BREAK: 300,
    LONG_BREAK: 900,
});

export const Defaults = Object.freeze({
    INTERVALS_PER_SET: 4,
    AUTO_START_BREAKS: false,
    AUTO_START_WORK: false,
    SOUND_ENABLED: true,
    SUSPEND_INHIBITOR_ENABLED: true,
});
