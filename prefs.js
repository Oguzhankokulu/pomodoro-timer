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

        // Focus Mode Page
        const focusPage = new Adw.PreferencesPage({
            title: 'Focus Mode',
            icon_name: 'focus-mode-symbolic',
        });
        window.add(focusPage);

        // Master Toggle Group
        const focusToggleGroup = new Adw.PreferencesGroup({
            title: 'Focus Mode',
            description: 'Reduce distractions during work sessions',
        });
        focusPage.add(focusToggleGroup);

        focusToggleGroup.add(
            this._createSwitchRow(
                settings,
                'focus-mode-enabled',
                'Enable Focus Mode',
                'Activate focus mode when a work session starts'
            )
        );

        // Wallpaper Group
        const wallpaperGroup = new Adw.PreferencesGroup({
            title: 'Wallpaper',
            description: 'Change wallpaper during work sessions',
        });
        focusPage.add(wallpaperGroup);

        const wallpaperModel = new Gtk.StringList();
        wallpaperModel.append('Anime');
        wallpaperModel.append('Cloudscape');
        wallpaperModel.append('Dark Academia');
        wallpaperModel.append('Forest');
        wallpaperModel.append('Minecraft');
        wallpaperModel.append('Custom Image');

        const wallpaperOptionMap = ['anime', 'cloudscape', 'dark-academia', 'forest', 'minecraft', 'custom'];
        const wallpaperRow = new Adw.ComboRow({
            title: 'Wallpaper',
            subtitle: 'Select a focus wallpaper',
            model: wallpaperModel,
        });

        const currentOption = settings.get_string('focus-wallpaper-option');
        const currentIdx = wallpaperOptionMap.indexOf(currentOption);
        if (currentIdx >= 0)
            wallpaperRow.selected = currentIdx;

        wallpaperRow.connect('notify::selected', () => {
            const idx = wallpaperRow.selected;
            if (idx >= 0 && idx < wallpaperOptionMap.length)
                settings.set_string('focus-wallpaper-option', wallpaperOptionMap[idx]);
        });
        wallpaperGroup.add(wallpaperRow);

        // Custom wallpaper path row
        const customPathRow = new Adw.ActionRow({
            title: 'Custom Image',
            subtitle: settings.get_string('focus-custom-wallpaper') || 'No file selected',
        });

        const browseBtn = new Gtk.Button({
            label: 'Browse',
            valign: Gtk.Align.CENTER,
        });
        browseBtn.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: 'Select Focus Wallpaper',
            });

            const imageFilter = new Gtk.FileFilter();
            imageFilter.set_name('Images');
            imageFilter.add_mime_type('image/png');
            imageFilter.add_mime_type('image/jpeg');
            imageFilter.add_mime_type('image/webp');
            const filterModel = new Gio.ListStore({item_type: Gtk.FileFilter});
            filterModel.append(imageFilter);
            dialog.filters = filterModel;

            dialog.open(window, null, (_dialog, result) => {
                try {
                    const file = dialog.open_finish(result);
                    if (file) {
                        const path = file.get_path();
                        settings.set_string('focus-custom-wallpaper', path);
                        customPathRow.subtitle = path;
                    }
                } catch {
                    // User cancelled the dialog
                }
            });
        });
        customPathRow.add_suffix(browseBtn);
        customPathRow.activatable_widget = browseBtn;

        // Only show custom path row when "Custom Image" is selected
        customPathRow.visible = wallpaperOptionMap[wallpaperRow.selected] === 'custom';
        wallpaperRow.connect('notify::selected', () => {
            customPathRow.visible = wallpaperOptionMap[wallpaperRow.selected] === 'custom';
        });
        wallpaperGroup.add(customPathRow);

        // Distraction Control Group
        const distractionGroup = new Adw.PreferencesGroup({
            title: 'Distractions',
            description: 'Control notifications during work sessions',
        });
        focusPage.add(distractionGroup);

        distractionGroup.add(
            this._createSwitchRow(
                settings,
                'focus-dnd-enabled',
                'Do Not Disturb',
                'Suppress notification banners'
            )
        );
        distractionGroup.add(
            this._createSwitchRow(
                settings,
                'focus-mute-sounds',
                'Mute Notification Sounds',
                'Silence system event sounds'
            )
        );
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
