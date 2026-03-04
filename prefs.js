import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PomodoroPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Timer Settings Page
        const timerPage = new Adw.PreferencesPage({
            title: 'Timer',
            icon_name: 'preferences-system-time-symbolic',
        });
        window.add(timerPage);

        // Auto-start Group
        const autoGroup = new Adw.PreferencesGroup({
            title: 'Auto-start',
            description: 'Automatically start next interval',
        });
        timerPage.add(autoGroup);

        autoGroup.add(
            this._createSwitchRow(
                settings,
                'auto-start-breaks',
                'Auto-start Breaks',
                'Start break timer automatically after work'
            )
        );
        autoGroup.add(
            this._createSwitchRow(
                settings,
                'auto-start-work',
                'Auto-start Work',
                'Start work timer automatically after break'
            )
        );

        // Appearance Page
        const appearancePage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'applications-graphics-symbolic',
        });
        window.add(appearancePage);

        // Panel Group
        const panelGroup = new Adw.PreferencesGroup({
            title: 'Panel Button',
            description: 'Configure panel button appearance',
        });
        appearancePage.add(panelGroup);

        panelGroup.add(
            this._createSwitchRow(
                settings,
                'show-timer-always',
                'Always Show Timer',
                'Show timer even when not running'
            )
        );

        // Behavior Page
        const behaviorPage = new Adw.PreferencesPage({
            title: 'Behavior',
            icon_name: 'preferences-other-symbolic',
        });
        window.add(behaviorPage);

        // Sound Group
        const soundGroup = new Adw.PreferencesGroup({
            title: 'Sounds',
            description: 'Configure sound effects',
        });
        behaviorPage.add(soundGroup);

        soundGroup.add(
            this._createSwitchRow(
                settings,
                'sound-enabled',
                'Enable Sounds',
                'Play sounds for timer events'
            )
        );
        soundGroup.add(
            this._createSwitchRow(
                settings,
                'tick-sound-enabled',
                'Tick Sound',
                'Play ticking sound while running'
            )
        );

        const eventVolumeAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 100,
            step_increment: 5,
            page_increment: 10,
            value: Math.round(settings.get_double('event-sound-volume') * 100),
        });
        const eventVolumeRow = new Adw.SpinRow({
            title: 'Event Volume',
            subtitle: 'Volume for start and complete sounds',
            adjustment: eventVolumeAdjustment,
            digits: 0,
        });
        eventVolumeAdjustment.connect('value-changed', adj => {
            settings.set_double('event-sound-volume', adj.value / 100);
        });
        const eventVolSettingsId = settings.connect('changed::event-sound-volume', () => {
            eventVolumeAdjustment.value = Math.round(
                settings.get_double('event-sound-volume') * 100
            );
        });
        soundGroup.add(eventVolumeRow);

        const tickVolumeAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 100,
            step_increment: 5,
            page_increment: 10,
            value: Math.round(settings.get_double('tick-sound-volume') * 100),
        });
        const tickVolumeRow = new Adw.SpinRow({
            title: 'Tick Volume',
            subtitle: 'Volume for ticking sound',
            adjustment: tickVolumeAdjustment,
            digits: 0,
        });
        tickVolumeAdjustment.connect('value-changed', adj => {
            settings.set_double('tick-sound-volume', adj.value / 100);
        });
        const tickVolSettingsId = settings.connect('changed::tick-sound-volume', () => {
            tickVolumeAdjustment.value = Math.round(
                settings.get_double('tick-sound-volume') * 100
            );
        });
        soundGroup.add(tickVolumeRow);

        window.connect('close-request', () => {
            settings.disconnect(eventVolSettingsId);
            settings.disconnect(tickVolSettingsId);
            return false;
        });

        // System Group
        const systemGroup = new Adw.PreferencesGroup({
            title: 'System',
            description: 'System integration settings',
        });
        behaviorPage.add(systemGroup);

        systemGroup.add(
            this._createSwitchRow(
                settings,
                'suspend-inhibitor-enabled',
                'Prevent Auto-suspend',
                'Keep system awake during pomodoro'
            )
        );

        window.set_default_size(450, 500);
    }

    _createSwitchRow(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({
            title,
            subtitle,
        });
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}
