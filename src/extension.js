import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Indicator from './indicator.js';

export default class PomodoroExtension extends Extension {
    enable() {
        this._indicator = new Indicator.PomodoroIndicator(
            this.getSettings(),
            this.path
        );
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}