import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class DataStore {
    constructor(extensionUuid) {
        const dataDir = GLib.build_filenamev([
            GLib.get_user_data_dir(), extensionUuid,
        ]);
        GLib.mkdir_with_parents(dataDir, 0o755);
        this._file = Gio.File.new_for_path(
            GLib.build_filenamev([dataDir, 'data.json'])
        );
        this._data = null;
    }

    load() {
        if (this._file.query_exists(null)) {
            const [ok, contents] = this._file.load_contents(null);
            if (ok) {
                const text = new TextDecoder().decode(contents);
                try {
                    this._data = JSON.parse(text);
                } catch (e) {
                    console.warn(`Pomodoro: corrupted data.json, resetting: ${e.message}`);
                    this._data = {sessions: [], tasks: []};
                    return;
                }
                if (!Array.isArray(this._data.sessions))
                    this._data.sessions = [];
                if (!Array.isArray(this._data.tasks))
                    this._data.tasks = [];
                return;
            }
        }
        this._data = {sessions: [], tasks: []};
    }

    save() {
        if (!this._data)
            return;
        const json = JSON.stringify(this._data, null, 2);
        try {
            this._file.replace_contents(
                new TextEncoder().encode(json),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.error(`Pomodoro: failed to save data.json: ${e.message}`);
        }
    }

    getData() {
        return this._data;
    }

    destroy() {
        this.save();
        this._data = null;
    }
}
