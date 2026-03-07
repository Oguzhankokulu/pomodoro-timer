import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Indicator from './indicator.js';

const KEYBINDING_NAMES = [
    'keybinding-toggle',
    'keybinding-skip',
    'keybinding-reset',
    'keybinding-reset-all',
];

export default class PomodoroExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new Indicator.PomodoroIndicator(
            this._settings,
            this.path,
            this.uuid,
            this
        );
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        Main.wm.addKeybinding('keybinding-toggle', this._settings,
            Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
            () => this._indicator.toggleTimer());

        Main.wm.addKeybinding('keybinding-skip', this._settings,
            Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
            () => this._indicator.skipInterval());

        Main.wm.addKeybinding('keybinding-reset', this._settings,
            Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
            () => this._indicator.resetTimer());

        Main.wm.addKeybinding('keybinding-reset-all', this._settings,
            Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
            () => this._indicator.resetAll());
    }

    disable() {
        for (const name of KEYBINDING_NAMES)
            Main.wm.removeKeybinding(name);

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}
