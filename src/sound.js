// Sound Manager for Pomodoro Timer
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const SOUND_FILES = {
    START: 'start.ogg',
    TICK: 'tick.ogg',
    COMPLETE: 'complete.ogg',
};

export class SoundManager {
    constructor(extensionPath, settings) {
        this._extensionPath = extensionPath;
        this._settings = settings;
        this._soundsDir = GLib.build_filenamev([extensionPath, 'assets', 'sounds']);
        this._tickTimeoutId = null;
    }

    get soundEnabled() {
        return this._settings.get_boolean('sound-enabled');
    }

    get tickSoundEnabled() {
        return this._settings.get_boolean('tick-sound-enabled');
    }

    _playSound(soundFile) {
        if (!this.soundEnabled) return;

        const soundPath = GLib.build_filenamev([this._soundsDir, soundFile]);
        const file = Gio.File.new_for_path(soundPath);

        if (!file.query_exists(null)) {
            console.log(`Pomodoro: Sound file not found: ${soundPath}`);
            return;
        }

        // Try PipeWire first (GNOME 46+), then fall back to PulseAudio
        const players = ['pw-play', 'paplay'];

        for (const player of players) {
            try {
                const [success, pid] = GLib.spawn_async(
                    null,
                    [player, soundPath],
                    null,
                    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                    null
                );
                if (success) {
                    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => { });
                    return; // Successfully started playback
                }
            } catch (e) {
                // Try the next player
                continue;
            }
        }
        console.log(`Pomodoro: Failed to play sound - no audio player available`);
    }

    playStartSound() {
        this._playSound(SOUND_FILES.START);
    }

    playCompleteSound() {
        this._playSound(SOUND_FILES.COMPLETE);
    }

    playTickSound() {
        if (this.tickSoundEnabled) {
            this._playSound(SOUND_FILES.TICK);
        }
    }

    startTickLoop(intervalMs = 1000) {
        this.stopTickLoop();
        if (!this.tickSoundEnabled) return;

        this.playTickSound();
        this._tickTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            if (this.tickSoundEnabled) {
                this.playTickSound();
                return GLib.SOURCE_CONTINUE;
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    stopTickLoop() {
        if (this._tickTimeoutId) {
            GLib.source_remove(this._tickTimeoutId);
            this._tickTimeoutId = null;
        }
    }

    destroy() {
        this.stopTickLoop();
    }
}
