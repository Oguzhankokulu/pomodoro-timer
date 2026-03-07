import Adw from 'gi://Adw';
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

        window.set_default_size(600, 800);

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

        // Shared data layer
        this._dataStore = new DataStore(this.metadata.uuid);
        this._dataStore.load();
        this._statsTracker = new StatsTracker(this._dataStore);
        this._taskManager = new TaskManager(this._dataStore, settings);

        // Stats and Tasks pages
        this._buildStatsPage(window);
        this._buildTasksPage(window);

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
        const fieldsGroup = new Adw.PreferencesGroup();
        fieldsGroup.add(difficultyRow);
        fieldsGroup.add(estimateRow);
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
            this._taskManager.addTask(title, difficultyRow.value, estimateRow.value);
            titleEntry.text = '';
            difficultyRow.value = TaskDefaults.DEFAULT_DIFFICULTY;
            estimateRow.value = TaskDefaults.DEFAULT_ESTIMATED_POMODOROS;
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
}
