// Sound Manager for Pomodoro Timer
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gst from 'gi://Gst?version=1.0';

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

        // GStreamer is initialized lazily on first sound play,
        // not during constructor, to avoid crashing GNOME Shell
        // at startup when audio subsystems aren't ready yet.
        this._gstInitialized = false;
        this._useGStreamer = false;
        this._Gst = null;
    }

    _ensureGStreamer() {
        if (this._gstInitialized)
            return;

        this._gstInitialized = true;

        try {
            this._Gst = Gst;
            const [initialized] = this._Gst.init_check(null);
            if (!initialized)
                throw new Error('GStreamer init_check returned false');

            this._eventPlayer = this._createPlayer('pomodoro-event');
            this._tickPlayer = this._createPlayer('pomodoro-tick');

            if (this._eventPlayer && this._tickPlayer) {
                this._useGStreamer = true;
                this._applyVolume();
                this._eventVolChangedId = this._settings.connect(
                    'changed::event-sound-volume',
                    () => this._applyVolume()
                );
                this._tickVolChangedId = this._settings.connect(
                    'changed::tick-sound-volume',
                    () => this._applyVolume()
                );
            } else {
                this._Gst = null;
            }
        } catch (e) {
            console.warn(`Pomodoro: GStreamer unavailable: ${e.message}`);
            this._Gst = null;
        }

        if (!this._useGStreamer)
            this._soundPlayer = global.display.get_sound_player();
    }

    _createPlayer(name) {
        const gst = this._Gst;
        const player = gst.ElementFactory.make('playbin', name);
        if (!player)
            return null;

        const bus = player.get_bus();
        bus.add_signal_watch();

        const signals = [];
        signals.push(
            bus.connect('message::eos', () => {
                player.set_state(gst.State.NULL);
            })
        );
        signals.push(
            bus.connect('message::error', (_bus, msg) => {
                const [error] = msg.parse_error();
                console.error(`Pomodoro: GStreamer error (${name}): ${error.message}`);
                player.set_state(gst.State.NULL);
            })
        );

        player._bus = bus;
        player._busSignals = signals;

        return player;
    }

    _destroyPlayer(player) {
        if (!player)
            return;

        if (this._Gst)
            player.set_state(this._Gst.State.NULL);

        if (player._bus && player._busSignals) {
            player._busSignals.forEach(id => player._bus.disconnect(id));
            player._bus.remove_signal_watch();
            player._bus = null;
            player._busSignals = null;
        }
    }

    _applyVolume() {
        if (this._eventPlayer)
            this._eventPlayer.set_property('volume', this._settings.get_double('event-sound-volume'));
        if (this._tickPlayer)
            this._tickPlayer.set_property('volume', this._settings.get_double('tick-sound-volume'));
    }

    get soundEnabled() {
        return this._settings.get_boolean('sound-enabled');
    }

    get tickSoundEnabled() {
        return this._settings.get_boolean('tick-sound-enabled');
    }

    _playSound(soundFile, playerField) {
        if (!this.soundEnabled)
            return;

        this._ensureGStreamer();

        const soundPath = GLib.build_filenamev([this._soundsDir, soundFile]);
        const file = Gio.File.new_for_path(soundPath);

        if (!file.query_exists(null)) {
            console.warn(`Pomodoro: Sound file not found: ${soundPath}`);
            return;
        }

        try {
            if (this._useGStreamer && this[playerField]) {
                const player = this[playerField];
                const volumeKey = playerField === '_tickPlayer' ? 'tick-sound-volume' : 'event-sound-volume';
                player.set_state(this._Gst.State.NULL);
                player.set_property('uri', file.get_uri());
                player.set_property('volume', this._settings.get_double(volumeKey));
                player.set_state(this._Gst.State.PLAYING);
            } else if (this._soundPlayer) {
                this._soundPlayer.play_from_file(file, soundFile, null);
            }
        } catch (e) {
            console.error(`Pomodoro: Failed to play sound: ${e.message}`);
        }
    }

    playStartSound() {
        this._playSound(SOUND_FILES.START, '_eventPlayer');
    }

    playCompleteSound() {
        this._playSound(SOUND_FILES.COMPLETE, '_eventPlayer');
    }

    playTickSound() {
        if (this.tickSoundEnabled)
            this._playSound(SOUND_FILES.TICK, '_tickPlayer');
    }

    startTickLoop(intervalMs = 1000) {
        this.stopTickLoop();
        if (!this.tickSoundEnabled)
            return;

        this.playTickSound();
        this._tickTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            intervalMs,
            () => {
                if (this.tickSoundEnabled)
                    this.playTickSound();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    stopTickLoop() {
        if (this._tickTimeoutId) {
            GLib.source_remove(this._tickTimeoutId);
            this._tickTimeoutId = null;
        }
    }

    destroy() {
        this.stopTickLoop();

        if (this._eventVolChangedId) {
            this._settings.disconnect(this._eventVolChangedId);
            this._eventVolChangedId = null;
        }

        if (this._tickVolChangedId) {
            this._settings.disconnect(this._tickVolChangedId);
            this._tickVolChangedId = null;
        }

        this._destroyPlayer(this._eventPlayer);
        this._eventPlayer = null;

        this._destroyPlayer(this._tickPlayer);
        this._tickPlayer = null;

        this._soundPlayer = null;
    }
}
