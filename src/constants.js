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

export const WallpaperOption = Object.freeze({
    ANIME: 'anime',
    CLOUDSCAPE: 'cloudscape',
    DARK_ACADEMIA: 'dark-academia',
    FOREST: 'forest',
    MINECRAFT: 'minecraft',
    CUSTOM: 'custom',
});

export const DurationLimits = Object.freeze({
    STEP: 30,
    MIN: 30,
    MAX: 5400,
});

export const TaskDefaults = Object.freeze({
    MIN_DIFFICULTY: 1,
    MAX_DIFFICULTY: 10,
    DEFAULT_DIFFICULTY: 5,
    MIN_ESTIMATED_POMODOROS: 1,
    MAX_ESTIMATED_POMODOROS: 50,
    DEFAULT_ESTIMATED_POMODOROS: 4,
});
