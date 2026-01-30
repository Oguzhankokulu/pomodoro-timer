// Timer state machine for Pomodoro Timer
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import {TimerState, IntervalType} from './constants.js';

export const PomodoroTimer = GObject.registerClass(
    {
        Signals: {
            tick: {param_types: [GObject.TYPE_INT]},
            'state-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
            },
            'interval-changed': {param_types: [GObject.TYPE_STRING]},
            'interval-completed': {param_types: [GObject.TYPE_STRING]},
            'set-completed': {},
        },
    },
    class PomodoroTimer extends GObject.Object {
        _init(settings) {
            super._init();
            this._settings = settings;
            this._state = TimerState.IDLE;
            this._intervalType = IntervalType.WORK;
            this._remainingTime = this._getDuration(IntervalType.WORK);
            this._completedWorkIntervals = 0;
            this._timeoutId = null;

            // Restore saved state from GSettings (for screen lock persistence)
            this._restoreState();

            this._settingsChangedId = this._settings.connect(
                'changed',
                (_settings, key) => {
                    // Ignore session state changes to prevent feedback loops
                    if (key.startsWith('session-'))
                        return;

                    if (this._state === TimerState.IDLE) {
                        this._remainingTime = this._getDuration(this._intervalType);
                        this.emit('tick', this._remainingTime);
                    }
                }
            );
        }

        _getDuration(intervalType) {
            switch (intervalType) {
            case IntervalType.WORK:
                return this._settings.get_int('work-duration');
            case IntervalType.SHORT_BREAK:
                return this._settings.get_int('short-break-duration');
            case IntervalType.LONG_BREAK:
                return this._settings.get_int('long-break-duration');
            default:
                return 1500;
            }
        }

        _getIntervalsPerSet() {
            return this._settings.get_int('intervals-per-set');
        }

        _setState(newState) {
            if (this._state !== newState) {
                const oldState = this._state;
                this._state = newState;
                this.emit('state-changed', oldState, newState);
                this._saveState();
            }
        }

        start() {
            if (this._state === TimerState.RUNNING)
                return;
            if (this._state === TimerState.IDLE)
                this._remainingTime = this._getDuration(this._intervalType);

            this._setState(TimerState.RUNNING);
            this._startTicking();
        }

        pause() {
            if (this._state !== TimerState.RUNNING)
                return;
            this._stopTicking();
            this._setState(TimerState.PAUSED);
        }

        resume() {
            if (this._state !== TimerState.PAUSED)
                return;
            this._setState(TimerState.RUNNING);
            this._startTicking();
        }

        reset() {
            this._stopTicking();
            this._remainingTime = this._getDuration(this._intervalType);
            this._setState(TimerState.IDLE);
            this.emit('tick', this._remainingTime);
        }

        fullReset() {
            this._stopTicking();
            this._intervalType = IntervalType.WORK;
            this._completedWorkIntervals = 0;
            this._remainingTime = this._getDuration(IntervalType.WORK);
            this._setState(TimerState.IDLE);
            this._clearSavedState();
            this.emit('interval-changed', this._intervalType);
            this.emit('tick', this._remainingTime);
        }

        skip() {
            this._stopTicking();
            this._advanceToNextInterval();
            this._setState(TimerState.IDLE);
        }

        _advanceToNextInterval() {
            const prevType = this._intervalType;

            if (this._intervalType === IntervalType.WORK) {
                this._completedWorkIntervals++;
                if (this._completedWorkIntervals >= this._getIntervalsPerSet()) {
                    this._intervalType = IntervalType.LONG_BREAK;
                    this._completedWorkIntervals = 0;
                } else {
                    this._intervalType = IntervalType.SHORT_BREAK;
                }
            } else {
                this._intervalType = IntervalType.WORK;
            }

            this._remainingTime = this._getDuration(this._intervalType);
            this.emit('interval-changed', this._intervalType);
            this.emit('tick', this._remainingTime);

            if (prevType === IntervalType.LONG_BREAK)
                this.emit('set-completed');
        }

        _startTicking() {
            if (this._timeoutId)
                return;

            this._timeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                1,
                () => {
                    if (this._state !== TimerState.RUNNING) {
                        this._timeoutId = null;
                        return GLib.SOURCE_REMOVE;
                    }

                    this._remainingTime--;
                    this.emit('tick', this._remainingTime);

                    if (this._remainingTime <= 0) {
                        this._onIntervalComplete();
                        return GLib.SOURCE_REMOVE;
                    }
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        _stopTicking() {
            if (this._timeoutId) {
                GLib.source_remove(this._timeoutId);
                this._timeoutId = null;
            }
        }

        _onIntervalComplete() {
            this._timeoutId = null;
            const completedType = this._intervalType;

            this.emit('interval-completed', completedType);
            this._advanceToNextInterval();

            const autoStartBreaks = this._settings.get_boolean('auto-start-breaks');
            const autoStartWork = this._settings.get_boolean('auto-start-work');

            if (completedType === IntervalType.WORK && autoStartBreaks)
                this.start();
            else if (completedType !== IntervalType.WORK && autoStartWork)
                this.start();
            else
                this._setState(TimerState.IDLE);
        }

        // State persistence methods for screen lock survival
        _saveState() {
            this._settings.set_string('session-state', this._state);
            this._settings.set_string('session-interval-type', this._intervalType);
            this._settings.set_int('session-remaining-time', this._remainingTime);
            this._settings.set_int(
                'session-completed-intervals',
                this._completedWorkIntervals
            );
        }

        _restoreState() {
            const savedState = this._settings.get_string('session-state');
            const savedIntervalType = this._settings.get_string(
                'session-interval-type'
            );
            const savedRemainingTime = this._settings.get_int(
                'session-remaining-time'
            );
            const savedCompletedIntervals = this._settings.get_int(
                'session-completed-intervals'
            );

            // Only restore if we have valid saved state
            if (savedState && savedIntervalType && savedRemainingTime > 0) {
                this._state = savedState;
                this._intervalType = savedIntervalType;
                this._remainingTime = savedRemainingTime;
                this._completedWorkIntervals = savedCompletedIntervals;

                // If timer was running, resume it (it was paused due to screen lock)
                if (this._state === TimerState.RUNNING)
                    this._startTicking();
            }
        }

        _clearSavedState() {
            this._settings.set_string('session-state', '');
            this._settings.set_string('session-interval-type', '');
            this._settings.set_int('session-remaining-time', -1);
            this._settings.set_int('session-completed-intervals', 0);
        }

        get state() {
            return this._state;
        }

        get intervalType() {
            return this._intervalType;
        }

        get remainingTime() {
            return this._remainingTime;
        }

        get completedWorkIntervals() {
            return this._completedWorkIntervals;
        }

        get intervalsPerSet() {
            return this._getIntervalsPerSet();
        }

        destroy() {
            // Save state before destruction (for screen lock persistence)
            this._saveState();
            this._stopTicking();
            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = null;
            }
        }
    }
);
