// Idle detection for Away from Desk feature
import GLib from 'gi://GLib';

export class IdleMonitor {
    constructor(settings) {
        this._settings = settings;
        this._idleMonitor = global.backend.get_core_idle_monitor();
        this._idleWatchId = null;
        this._userActiveId = null;
        this._idleStartTime = null;
        this._wasRunning = false;
        this._onIdle = null;
        this._onReturn = null;
    }

    /**
     * Start monitoring for idle.
     *
     * @param {Function} onIdle - Called when user goes idle.
     * @param {Function} onReturn - Called when user returns with idle duration in seconds.
     */
    start(onIdle, onReturn) {
        this._onIdle = onIdle;
        this._onReturn = onReturn;
        this._installIdleWatch();
    }

    stop() {
        this._removeIdleWatch();
        this._removeUserActiveWatch();
        this._idleStartTime = null;
        this._onIdle = null;
        this._onReturn = null;
    }

    _getThresholdMs() {
        return this._settings.get_int('idle-threshold') * 1000;
    }

    _installIdleWatch() {
        this._removeIdleWatch();
        this._idleWatchId = this._idleMonitor.add_idle_watch(
            this._getThresholdMs(),
            () => this._onIdleDetected()
        );
    }

    _removeIdleWatch() {
        if (this._idleWatchId) {
            this._idleMonitor.remove_watch(this._idleWatchId);
            this._idleWatchId = null;
        }
    }

    _removeUserActiveWatch() {
        if (this._userActiveId) {
            this._idleMonitor.remove_watch(this._userActiveId);
            this._userActiveId = null;
        }
    }

    _onIdleDetected() {
        this._idleStartTime = GLib.get_monotonic_time();

        if (this._onIdle)
            this._onIdle();

        // Watch for user becoming active again
        this._userActiveId = this._idleMonitor.add_user_active_watch(
            () => this._onUserReturned()
        );
    }

    _onUserReturned() {
        this._userActiveId = null;

        const now = GLib.get_monotonic_time();
        const idleDurationSec = Math.round(
            (now - this._idleStartTime) / 1_000_000
        );
        this._idleStartTime = null;

        if (this._onReturn)
            this._onReturn(idleDurationSec);

        // Re-install idle watch for next idle period
        this._installIdleWatch();
    }

    destroy() {
        this.stop();
        this._settings = null;
        this._idleMonitor = null;
    }
}
