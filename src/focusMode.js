// Focus Mode Manager for Pomodoro Timer
// Manages wallpaper, DND, and notification sounds during work sessions
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {WallpaperOption} from './constants.js';

const WALLPAPER_FILES = {
    [WallpaperOption.ANIME]: 'anime.jpg',
    [WallpaperOption.CLOUDSCAPE]: 'cloudscape.jpg',
    [WallpaperOption.DARK_ACADEMIA]: 'dark-academia.jpg',
    [WallpaperOption.FOREST]: 'forest.jpg',
    [WallpaperOption.MINECRAFT]: 'minecraft.jpg',
};

export class FocusModeManager {
    constructor(settings, extensionPath) {
        this._settings = settings;
        this._extensionPath = extensionPath;
        this._wallpapersDir = GLib.build_filenamev([
            extensionPath, 'assets', 'wallpapers',
        ]);
        this._isActive = false;

        // Saved desktop state for restoration
        this._savedWallpaperUri = null;
        this._savedWallpaperUriDark = null;
        this._savedShowBanners = null;
        this._savedEventSounds = null;

        // System GSettings for desktop modifications
        this._bgSettings = new Gio.Settings({
            schema: 'org.gnome.desktop.background',
        });
        this._notifSettings = new Gio.Settings({
            schema: 'org.gnome.desktop.notifications',
        });
        this._soundSettings = new Gio.Settings({
            schema: 'org.gnome.desktop.sound',
        });

        // Crash recovery: restore desktop state if orphaned from a previous crash
        this._recoverOrphanedState();
    }

    get isActive() {
        return this._isActive;
    }

    activate() {
        if (this._isActive)
            return;

        this._saveDesktopState();
        this._applyFocusMode();
        this._isActive = true;
    }

    deactivate() {
        if (!this._isActive)
            return;

        this._restoreDesktopState();
        this._isActive = false;
    }

    _saveDesktopState() {
        this._savedWallpaperUri = this._bgSettings.get_string('picture-uri');
        this._savedWallpaperUriDark = this._bgSettings.get_string('picture-uri-dark');
        this._savedShowBanners = this._notifSettings.get_boolean('show-banners');
        this._savedEventSounds = this._soundSettings.get_boolean('event-sounds');

        // Persist to GSettings for crash recovery
        this._settings.set_string('focus-saved-wallpaper-uri', this._savedWallpaperUri);
        this._settings.set_string('focus-saved-wallpaper-uri-dark', this._savedWallpaperUriDark);
        this._settings.set_string('focus-saved-show-banners', String(this._savedShowBanners));
        this._settings.set_string('focus-saved-event-sounds', String(this._savedEventSounds));
    }

    _applyFocusMode() {
        // Change wallpaper if enabled
        if (this._settings.get_boolean('focus-wallpaper-enabled')) {
            const wallpaperUri = this._getWallpaperUri();
            if (wallpaperUri) {
                this._bgSettings.set_string('picture-uri', wallpaperUri);
                this._bgSettings.set_string('picture-uri-dark', wallpaperUri);
            }
        }

        // Enable Do Not Disturb if enabled
        if (this._settings.get_boolean('focus-dnd-enabled'))
            this._notifSettings.set_boolean('show-banners', false);

        // Mute notification sounds if enabled
        if (this._settings.get_boolean('focus-mute-sounds'))
            this._soundSettings.set_boolean('event-sounds', false);
    }

    _restoreDesktopState() {
        if (!this._settings || !this._bgSettings)
            return;

        if (this._savedWallpaperUri !== null) {
            this._bgSettings.set_string('picture-uri', this._savedWallpaperUri);
            this._bgSettings.set_string('picture-uri-dark', this._savedWallpaperUriDark);
        }
        if (this._savedShowBanners !== null)
            this._notifSettings.set_boolean('show-banners', this._savedShowBanners);
        if (this._savedEventSounds !== null)
            this._soundSettings.set_boolean('event-sounds', this._savedEventSounds);

        this._savedWallpaperUri = null;
        this._savedWallpaperUriDark = null;
        this._savedShowBanners = null;
        this._savedEventSounds = null;

        // Clear persisted recovery state
        this._clearPersistedState();
    }

    _recoverOrphanedState() {
        const uri = this._settings.get_string('focus-saved-wallpaper-uri');
        if (!uri)
            return;

        this._savedWallpaperUri = uri;
        this._savedWallpaperUriDark = this._settings.get_string('focus-saved-wallpaper-uri-dark');

        const banners = this._settings.get_string('focus-saved-show-banners');
        this._savedShowBanners = banners === 'true';

        const sounds = this._settings.get_string('focus-saved-event-sounds');
        this._savedEventSounds = sounds === 'true';

        this._restoreDesktopState();
    }

    _clearPersistedState() {
        this._settings.set_string('focus-saved-wallpaper-uri', '');
        this._settings.set_string('focus-saved-wallpaper-uri-dark', '');
        this._settings.set_string('focus-saved-show-banners', '');
        this._settings.set_string('focus-saved-event-sounds', '');
    }

    _getWallpaperUri() {
        const option = this._settings.get_string('focus-wallpaper-option');

        if (option === WallpaperOption.CUSTOM) {
            const customPath = this._settings.get_string('focus-custom-wallpaper');
            if (customPath) {
                const file = Gio.File.new_for_path(customPath);
                if (file.query_exists(null))
                    return file.get_uri();
            }
            return null;
        }

        const filename = WALLPAPER_FILES[option];
        if (filename) {
            const path = GLib.build_filenamev([this._wallpapersDir, filename]);
            return Gio.File.new_for_path(path).get_uri();
        }

        return null;
    }

    destroy() {
        this.deactivate();
        this._bgSettings = null;
        this._notifSettings = null;
        this._soundSettings = null;
    }
}
