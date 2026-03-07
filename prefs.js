import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {TaskDefaults} from './constants.js';
import {DataStore} from './dataStore.js';
import {StatsTracker} from './statsTracker.js';
import {TaskManager} from './taskManager.js';

export default class PomodoroPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Appearance Page (added to window later, before About)
        const appearancePage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'applications-graphics-symbolic',
        });

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

        // Theme Group
        const themeGroup = new Adw.PreferencesGroup({
            title: 'Theme',
            description: 'Configure extension colors',
        });
        appearancePage.add(themeGroup);

        themeGroup.add(
            this._createSwitchRow(
                settings,
                'use-system-theme',
                'Use System Theme',
                'Blend with GNOME theme colors instead of red'
            )
        );

        // Behavior Page
        const behaviorPage = new Adw.PreferencesPage({
            title: 'Behavior',
            icon_name: 'preferences-other-symbolic',
        });
        window.add(behaviorPage);

        // Timer Group
        const timerGroup = new Adw.PreferencesGroup({
            title: 'Timer',
            description: 'Automatically start next interval',
        });
        behaviorPage.add(timerGroup);

        timerGroup.add(
            this._createSwitchRow(
                settings,
                'auto-start-breaks',
                'Auto-start Breaks',
                'Start break timer automatically after work'
            )
        );
        timerGroup.add(
            this._createSwitchRow(
                settings,
                'auto-start-work',
                'Auto-start Work',
                'Start work timer automatically after break'
            )
        );

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

        // Keybindings Group
        const keybindingsGroup = new Adw.PreferencesGroup({
            title: 'Keybindings',
            description: 'Set keyboard shortcuts. A modifier key (Ctrl, Alt, or Super) is required. Backspace to clear.',
        });
        behaviorPage.add(keybindingsGroup);

        keybindingsGroup.add(this._createKeybindingRow(
            settings, 'keybinding-toggle', 'Start / Pause'
        ));
        keybindingsGroup.add(this._createKeybindingRow(
            settings, 'keybinding-skip', 'Skip Interval'
        ));
        keybindingsGroup.add(this._createKeybindingRow(
            settings, 'keybinding-reset', 'Reset'
        ));
        keybindingsGroup.add(this._createKeybindingRow(
            settings, 'keybinding-reset-all', 'Reset All'
        ));

        window.set_default_size(600, 800);

        // Focus Mode Page
        const focusPage = new Adw.PreferencesPage({
            title: 'Focus Mode',
            icon_name: 'focus-mode-symbolic',
        });
        window.add(focusPage);

        // Wallpaper Group
        const wallpaperGroup = new Adw.PreferencesGroup({
            title: 'Wallpaper',
            description: 'Change wallpaper during work sessions',
        });

        wallpaperGroup.add(
            this._createSwitchRow(
                settings,
                'focus-wallpaper-enabled',
                'Change Wallpaper',
                'Switch to a focus wallpaper during work sessions'
            )
        );
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
            title: 'Notifications',
            description: 'Control system notifications during work sessions',
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
        distractionGroup.add(
            this._createSwitchRow(
                settings,
                'notify-enabled',
                'Pomodoro Notifications',
                'Show system notifications for session events'
            )
        );

        // Task Automation Group
        const automationGroup = new Adw.PreferencesGroup({
            title: 'Task Automation',
            description: 'Automatically manage task completion',
        });
        focusPage.add(automationGroup);

        automationGroup.add(
            this._createSwitchRow(
                settings,
                'auto-complete-tasks',
                'Auto-complete Tasks',
                'Complete non-repeated tasks when estimated pomodoros are reached'
            )
        );

        // Shared data layer
        this._dataStore = new DataStore(this.metadata.uuid);
        this._dataStore.load();
        this._statsTracker = new StatsTracker(this._dataStore);
        this._taskManager = new TaskManager(this._dataStore, settings);

        // Stats, Tasks, Appearance, and About pages
        this._buildStatsPage(window);
        this._buildTasksPage(window);
        window.add(appearancePage);
        this._buildAboutPage(window);

        window.connect('close-request', () => {
            this._dataStore = null;
            this._statsTracker = null;
            this._taskManager = null;
            return false;
        });
    }

    _createSwitchRow(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({
            title,
            subtitle,
        });
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _createKeybindingRow(settings, key, title) {
        const row = new Adw.ActionRow({title});

        const current = settings.get_strv(key);
        const shortcutLabel = new Gtk.ShortcutLabel({
            accelerator: current.length > 0 ? current[0] : '',
            disabled_text: 'New shortcut…',
            valign: Gtk.Align.CENTER,
        });

        const btn = new Gtk.Button({
            child: shortcutLabel,
            has_frame: false,
            valign: Gtk.Align.CENTER,
        });
        row.add_suffix(btn);
        row.activatable_widget = btn;

        btn.connect('clicked', () => {
            const editor = new Gtk.Window({
                title: `Set ${title}`,
                modal: true,
                hide_on_close: true,
                transient_for: btn.get_root(),
                width_request: 480,
                height_request: 260,
                child: new Gtk.Label({
                    label: 'Press a key combination\n\nBackspace to clear · Escape to cancel',
                    valign: Gtk.Align.CENTER,
                    halign: Gtk.Align.CENTER,
                }),
            });

            const ctl = new Gtk.EventControllerKey();
            editor.add_controller(ctl);

            ctl.connect('key-pressed', (_widget, keyval, keycode, state) => {
                let mask = state & Gtk.accelerator_get_default_mod_mask();
                mask &= ~Gdk.ModifierType.LOCK_MASK;

                if (!mask && keyval === Gdk.KEY_Escape) {
                    editor.close();
                    return Gdk.EVENT_STOP;
                }

                if (keyval === Gdk.KEY_BackSpace) {
                    settings.set_strv(key, []);
                    shortcutLabel.accelerator = '';
                    editor.close();
                    return Gdk.EVENT_STOP;
                }

                if (
                    !this._isValidBinding(mask, keycode, keyval) ||
                    !Gtk.accelerator_valid(keyval, mask)
                )
                    return Gdk.EVENT_STOP;

                const accel = Gtk.accelerator_name_with_keycode(
                    null, keyval, keycode, mask
                );
                settings.set_strv(key, [accel]);
                shortcutLabel.accelerator = accel;
                editor.close();
                return Gdk.EVENT_STOP;
            });

            editor.present();
        });

        return row;
    }

    _isValidBinding(mask, keycode, keyval) {
        if (mask === 0)
            return false;
        if (
            mask === Gdk.ModifierType.SHIFT_MASK && keycode !== 0 &&
            ((keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
             (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
             (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9) ||
             keyval === Gdk.KEY_space ||
             this._isKeyvalForbidden(keyval))
        )
            return false;
        return true;
    }

    _isKeyvalForbidden(keyval) {
        return [
            Gdk.KEY_Home, Gdk.KEY_Left, Gdk.KEY_Up, Gdk.KEY_Right,
            Gdk.KEY_Down, Gdk.KEY_Page_Up, Gdk.KEY_Page_Down, Gdk.KEY_End,
            Gdk.KEY_Tab, Gdk.KEY_KP_Enter, Gdk.KEY_Return,
            Gdk.KEY_Mode_switch,
        ].includes(keyval);
    }

    _buildStatsPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Statistics',
            icon_name: 'utilities-system-monitor-symbolic',
        });
        window.add(page);

        // Summary from StatsTracker
        const summaryGroup = new Adw.PreferencesGroup({
            title: 'Summary',
        });
        page.add(summaryGroup);

        const allTime = this._statsTracker.getAllTimeStats();
        const efficiency = this._statsTracker.getEfficiency('all-time');

        summaryGroup.add(this._infoRow('Total Sessions', `${allTime.totalSessions}`));
        summaryGroup.add(this._infoRow('Total Hours', `${allTime.totalHours}h`));
        summaryGroup.add(this._infoRow('Current Streak', `${allTime.currentStreak} days`));
        summaryGroup.add(this._infoRow('Best Streak', `${allTime.bestStreak} days`));
        summaryGroup.add(this._infoRow('Efficiency Score', `${efficiency}`));

        // Task stats from StatsTracker
        const taskStatsGroup = new Adw.PreferencesGroup({
            title: 'Task Statistics',
        });
        page.add(taskStatsGroup);

        const taskStats = this._statsTracker.getTaskCompletionStats();

        taskStatsGroup.add(this._infoRow('Tasks Completed', `${taskStats.totalCompleted}`));
        taskStatsGroup.add(this._infoRow('Avg Difficulty', `${taskStats.avgDifficulty}`));
        taskStatsGroup.add(this._infoRow('Avg Pomodoros/Task', `${taskStats.avgPomodoros}`));

        // Charts from StatsTracker
        const toChartData = entries => entries.map(e => ({
            label: e.label,
            value: e.totalMinutes,
        }));

        this._addChart(page, 'Last 7 Days', toChartData(this._statsTracker.getWeekStats()));
        this._addChart(page, 'Last 4 Weeks', toChartData(this._statsTracker.getMonthStats()));
        this._addChart(page, 'Last 12 Months', toChartData(this._statsTracker.getYearStats()));
    }

    _infoRow(title, value) {
        const row = new Adw.ActionRow({title});
        row.add_suffix(new Gtk.Label({
            label: value,
            css_classes: ['dim-label'],
        }));
        return row;
    }

    _addChart(page, title, chartData) {
        const group = new Adw.PreferencesGroup({title});
        page.add(group);

        const maxVal = Math.max(...chartData.map(d => d.value), 1);

        const drawArea = new Gtk.DrawingArea();
        drawArea.set_content_width(380);
        drawArea.set_content_height(160);
        drawArea.set_draw_func((area, cr, width, height) => {
            const barCount = chartData.length;
            const padding = 30;
            const chartW = width - padding * 2;
            const chartH = height - padding - 20;
            const barW = chartW / barCount * 0.6;
            const gap = chartW / barCount * 0.4;

            // Bars
            cr.setSourceRGBA(0.35, 0.65, 0.85, 0.85);
            for (let i = 0; i < barCount; i++) {
                const barH = (chartData[i].value / maxVal) * chartH;
                const x = padding + i * (barW + gap) + gap / 2;
                const y = height - padding - barH;
                cr.rectangle(x, y, barW, barH);
                cr.fill();
            }

            // Labels
            cr.setSourceRGBA(0.7, 0.7, 0.7, 1);
            cr.setFontSize(10);
            for (let i = 0; i < barCount; i++) {
                const x = padding + i * (barW + gap) + gap / 2;
                cr.moveTo(x, height - 5);
                cr.showText(chartData[i].label);
            }

            // Value labels on bars
            cr.setSourceRGBA(0.9, 0.9, 0.9, 1);
            cr.setFontSize(9);
            for (let i = 0; i < barCount; i++) {
                if (chartData[i].value > 0) {
                    const barH = (chartData[i].value / maxVal) * chartH;
                    const x = padding + i * (barW + gap) + gap / 2;
                    const y = height - padding - barH - 4;
                    cr.moveTo(x, y);
                    cr.showText(`${chartData[i].value}m`);
                }
            }
        });

        const actionRow = new Adw.ActionRow({activatable: false});
        actionRow.set_child(drawArea);
        group.add(actionRow);
    }

    _showEditDialog(window, task, onSave) {
        const dialog = new Adw.AlertDialog({
            heading: 'Edit Task',
            close_response: 'cancel',
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('save', 'Save');
        dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
        });

        const titleEntry = new Adw.EntryRow({title: 'Task Title'});
        titleEntry.text = task.title;
        const titleGroup = new Adw.PreferencesGroup();
        titleGroup.add(titleEntry);
        box.append(titleGroup);

        const difficultyRow = new Adw.SpinRow({
            title: 'Difficulty',
            subtitle: '1 (easy) to 10 (hard)',
            adjustment: new Gtk.Adjustment({
                lower: TaskDefaults.MIN_DIFFICULTY,
                upper: TaskDefaults.MAX_DIFFICULTY,
                step_increment: 1,
                value: task.difficulty,
            }),
        });
        const estimateRow = new Adw.SpinRow({
            title: 'Estimated Pomodoros',
            adjustment: new Gtk.Adjustment({
                lower: TaskDefaults.MIN_ESTIMATED_POMODOROS,
                upper: TaskDefaults.MAX_ESTIMATED_POMODOROS,
                step_increment: 1,
                value: task.pomodorosEstimated,
            }),
        });
        const repeatedRow = new Adw.SwitchRow({
            title: 'Repeated Task',
            subtitle: 'Task stays active with progress reset on completion',
            active: !!task.repeated,
        });
        const fieldsGroup = new Adw.PreferencesGroup();
        fieldsGroup.add(difficultyRow);
        fieldsGroup.add(estimateRow);
        fieldsGroup.add(repeatedRow);
        box.append(fieldsGroup);

        dialog.set_extra_child(box);

        dialog.connect('response', (_dialog, response) => {
            if (response === 'save') {
                const title = titleEntry.text.trim();
                if (title) {
                    onSave({
                        title,
                        difficulty: difficultyRow.value,
                        pomodorosEstimated: estimateRow.value,
                        repeated: repeatedRow.active,
                    });
                }
            }
        });

        dialog.present(window);
    }

    _buildTasksPage(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Tasks',
            icon_name: 'view-list-symbolic',
        });
        window.add(page);

        // Add task group
        const addGroup = new Adw.PreferencesGroup({
            title: 'Add Task',
        });
        page.add(addGroup);

        const titleEntry = new Adw.EntryRow({title: 'Task Title'});
        addGroup.add(titleEntry);

        const difficultyRow = new Adw.SpinRow({
            title: 'Difficulty',
            subtitle: '1 (easy) to 10 (hard)',
            adjustment: new Gtk.Adjustment({
                lower: TaskDefaults.MIN_DIFFICULTY,
                upper: TaskDefaults.MAX_DIFFICULTY,
                step_increment: 1,
                value: TaskDefaults.DEFAULT_DIFFICULTY,
            }),
        });
        addGroup.add(difficultyRow);

        const estimateRow = new Adw.SpinRow({
            title: 'Estimated Pomodoros',
            adjustment: new Gtk.Adjustment({
                lower: TaskDefaults.MIN_ESTIMATED_POMODOROS,
                upper: TaskDefaults.MAX_ESTIMATED_POMODOROS,
                step_increment: 1,
                value: TaskDefaults.DEFAULT_ESTIMATED_POMODOROS,
            }),
        });
        addGroup.add(estimateRow);

        const repeatedRow = new Adw.SwitchRow({
            title: 'Repeated Task',
            subtitle: 'Task stays active with progress reset on completion',
        });
        addGroup.add(repeatedRow);

        const addBtnRow = new Adw.ActionRow();
        const addBtn = new Gtk.Button({
            label: 'Add Task',
            css_classes: ['suggested-action'],
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        addBtnRow.set_child(addBtn);
        addGroup.add(addBtnRow);

        // Active tasks group
        const activeGroup = new Adw.PreferencesGroup({
            title: 'Active Tasks',
        });
        page.add(activeGroup);

        // Completed tasks group
        const completedGroup = new Adw.PreferencesGroup({
            title: 'History',
        });
        page.add(completedGroup);

        // Track rows for proper removal
        let activeRows = [];
        let completedRows = [];

        const refreshTasks = () => {
            this._dataStore.load();
            const currentTaskId = settings.get_string('current-task-id');

            // Remove old active rows
            for (const row of activeRows)
                activeGroup.remove(row);
            activeRows = [];

            // Populate active tasks
            const active = this._taskManager.getActiveTasks();
            for (const task of active) {
                const isCurrent = task.id === currentTaskId;
                const row = new Adw.ActionRow({
                    title: `${isCurrent ? '● ' : ''}${task.title}`,
                    subtitle: `Difficulty: ${task.difficulty} · Progress: ${task.pomodorosCompleted}/${task.pomodorosEstimated}${isCurrent ? ' · Current' : ''}`,
                });

                if (task.repeated) {
                    row.add_prefix(new Gtk.Image({
                        icon_name: 'media-playlist-repeat-symbolic',
                        tooltip_text: 'Repeated Task',
                    }));
                }

                const assignBtn = new Gtk.Button({
                    icon_name: isCurrent ? 'emblem-default-symbolic' : 'media-playback-start-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: isCurrent ? ['flat', 'accent'] : ['flat'],
                    tooltip_text: isCurrent ? 'Current Task' : 'Set as Current',
                    sensitive: !isCurrent,
                });
                assignBtn.connect('clicked', () => {
                    settings.set_string('current-task-id', task.id);
                    refreshTasks();
                });
                row.add_suffix(assignBtn);

                const editBtn = new Gtk.Button({
                    icon_name: 'document-edit-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: 'Edit',
                });
                editBtn.connect('clicked', () => {
                    this._showEditDialog(window, task, fields => {
                        this._taskManager.updateTask(task.id, fields);
                        refreshTasks();
                    });
                });
                row.add_suffix(editBtn);

                const completeBtn = new Gtk.Button({
                    icon_name: 'object-select-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: 'Complete',
                });
                completeBtn.connect('clicked', () => {
                    this._taskManager.completeTask(task.id);
                    refreshTasks();
                });
                row.add_suffix(completeBtn);

                const deleteBtn = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat', 'error'],
                    tooltip_text: 'Delete',
                });
                deleteBtn.connect('clicked', () => {
                    this._taskManager.deleteTask(task.id);
                    refreshTasks();
                });
                row.add_suffix(deleteBtn);

                activeGroup.add(row);
                activeRows.push(row);
            }

            if (active.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: 'No active tasks',
                    subtitle: 'Add a task above to get started',
                });
                activeGroup.add(emptyRow);
                activeRows.push(emptyRow);
            }

            // Remove old completed rows
            for (const row of completedRows)
                completedGroup.remove(row);
            completedRows = [];

            const done = this._taskManager.getCompletedTasks();

            if (done.length > 0) {
                const expander = new Adw.ExpanderRow({
                    title: `Completed (${done.length})`,
                    show_enable_switch: false,
                });

                for (const task of done) {
                    const dateStr = new Date(task.completedAt).toLocaleDateString();
                    const row = new Adw.ActionRow({
                        title: task.title,
                        subtitle: `Difficulty: ${task.difficulty} · ${task.pomodorosCompleted} pomodoros · ${dateStr}`,
                    });

                    const editBtn = new Gtk.Button({
                        icon_name: 'document-edit-symbolic',
                        valign: Gtk.Align.CENTER,
                        css_classes: ['flat'],
                        tooltip_text: 'Edit',
                    });
                    editBtn.connect('clicked', () => {
                        this._showEditDialog(window, task, fields => {
                            this._taskManager.updateTask(task.id, fields);
                            refreshTasks();
                        });
                    });
                    row.add_suffix(editBtn);

                    const deleteBtn = new Gtk.Button({
                        icon_name: 'user-trash-symbolic',
                        valign: Gtk.Align.CENTER,
                        css_classes: ['flat', 'error'],
                        tooltip_text: 'Delete',
                    });
                    deleteBtn.connect('clicked', () => {
                        this._taskManager.deleteTask(task.id);
                        refreshTasks();
                    });
                    row.add_suffix(deleteBtn);

                    expander.add_row(row);
                }

                completedGroup.add(expander);
                completedRows.push(expander);
            }
        };

        addBtn.connect('clicked', () => {
            const title = titleEntry.text.trim();
            if (!title)
                return;
            this._taskManager.addTask(title, difficultyRow.value, estimateRow.value, repeatedRow.active);
            titleEntry.text = '';
            difficultyRow.value = TaskDefaults.DEFAULT_DIFFICULTY;
            estimateRow.value = TaskDefaults.DEFAULT_ESTIMATED_POMODOROS;
            repeatedRow.active = false;
            refreshTasks();
        });

        refreshTasks();

        // Sync with shell process changes (e.g. completing a task from dropdown)
        const taskSettingId = settings.connect('changed::current-task-id', () => {
            refreshTasks();
        });
        window.connect('close-request', () => {
            settings.disconnect(taskSettingId);
            return false;
        });
    }

    _buildAboutPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });
        window.add(page);

        // About section
        const aboutGroup = new Adw.PreferencesGroup({
            title: `Pomodoro Timer - v${this.metadata['version-name'] || ''}`,
            description: 'A simple and effective Pomodoro timer for GNOME Shell\n© 2025 Oguzhan Kokulu · Licensed under GPL-3.0',
        });
        page.add(aboutGroup);

        const repoRow = new Adw.ActionRow({
            title: 'Homepage',
            activatable: true,
        });
        repoRow.add_suffix(new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        repoRow.connect('activated', () => {
            Gtk.show_uri(window, this.metadata.url, 0);
        });
        aboutGroup.add(repoRow);

        const releaseNotesRow = new Adw.ActionRow({
            title: 'Release Notes',
            activatable: true,
        });
        releaseNotesRow.add_suffix(new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        releaseNotesRow.connect('activated', () => {
            Gtk.show_uri(window, 'https://github.com/Oguzhankokulu/pomodoro-timer/releases', 0);
        });
        aboutGroup.add(releaseNotesRow);

        const issueRow = new Adw.ActionRow({
            title: 'Report an Issue/Feature Request',
            activatable: true,
        });
        issueRow.add_suffix(new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        issueRow.connect('activated', () => {
            Gtk.show_uri(window, 'https://github.com/Oguzhankokulu/pomodoro-timer/issues', 0);
        });
        aboutGroup.add(issueRow);

        // Donations section
        const donateGroup = new Adw.PreferencesGroup({
            title: 'Support',
            description: 'Your support helps maintain and improve Pomodoro Timer, develop new features, and ensure smooth updates. Even a small donation makes a big difference!\n\nThank you for your support!',
        });
        page.add(donateGroup);

        const bmcUrl = 'https://buymeacoffee.com/oguzhankokl';

        const bmcBtnRow = new Adw.ActionRow({activatable: false});
        const bmcBtn = new Gtk.Button({
            halign: Gtk.Align.CENTER,
            hexpand: true,
        });
        bmcBtn.add_css_class('bmc-button');

        const bmcBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.CENTER,
        });
        bmcBox.append(new Gtk.Label({label: '☕'}));
        bmcBox.append(new Gtk.Label({label: 'Buy me a coffee'}));
        bmcBtn.set_child(bmcBox);

        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_string(`
            .bmc-button {
                background-color: #FF5F5F;
                color: #ffffff;
                font-weight: bold;
                font-size: 16px;
                padding: 12px 32px;
                border-radius: 12px;
                border: none;
                min-height: 36px;
            }
            .bmc-button:hover {
                background-color: #e04545;
            }
        `);
        bmcBtn.get_style_context().add_provider(
            cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        bmcBtn.connect('clicked', () => {
            Gtk.show_uri(window, bmcUrl, 0);
        });
        bmcBtnRow.set_child(bmcBtn);
        donateGroup.add(bmcBtnRow);

        // QR code
        const qrGroup = new Adw.PreferencesGroup({
            title: 'Scan to Donate',
        });
        page.add(qrGroup);

        const qrPath = this.dir.get_child('assets')
            .get_child('images').get_child('qr-code.png').get_path();
        const qrImage = Gtk.Picture.new_for_filename(qrPath);
        qrImage.set_content_fit(Gtk.ContentFit.CONTAIN);
        qrImage.set_size_request(300, 300);
        qrImage.set_margin_top(12);
        qrImage.set_margin_bottom(12);

        const qrRow = new Adw.ActionRow({activatable: false});
        qrRow.set_child(qrImage);
        qrGroup.add(qrRow);
    }
}
