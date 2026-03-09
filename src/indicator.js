// Panel Indicator for Pomodoro Timer
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';

import {TimerState, IntervalType, DurationLimits} from './constants.js';
import {formatTime, getIntervalDisplayName} from './utils.js';
import {PomodoroTimer} from './timer.js';
import {SoundManager} from './sound.js';
import {SuspendInhibitor} from './suspendInhibitor.js';
import {FocusModeManager} from './focusMode.js';
import {DataStore} from './dataStore.js';
import {StatsTracker} from './statsTracker.js';
import {TaskManager} from './taskManager.js';
import {IdleMonitor} from './idleMonitor.js';


// Duration adjustment menu item with +/- buttons and editable entry
const DurationAdjustMenuItem = GObject.registerClass(
    {GTypeName: 'PomodoroTimerDurationAdjustMenuItem'},
    class DurationAdjustMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(label, settingsKey, settings, timer, defaultValue) {
            super._init({reactive: false});
            this._settingsKey = settingsKey;
            this._settings = settings;
            this._timer = timer;
            this._defaultValue = defaultValue;
            this._isEditing = false;

            const box = new St.BoxLayout({
                x_expand: true,
                style_class: 'pomodoro-duration-row',
            });

            this._labelWidget = new St.Label({
                text: label,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style_class: 'pomodoro-duration-label',
            });

            this._resetBtn = new St.Button({
                style_class: 'pomodoro-adjust-button pomodoro-reset-btn',
                child: new St.Label({text: '↺'}),
            });
            this._resetBtn.connect('clicked', () => this._resetToDefault());

            this._minusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({text: '−'}),
            });
            this._minusBtn.connect('clicked', () =>
                this._adjustDuration(-DurationLimits.STEP)
            );

            // Clickable label that becomes an entry on click
            this._durationBtn = new St.Button({
                style_class: 'pomodoro-duration-value-btn',
            });
            this._durationLabel = new St.Label({
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'pomodoro-duration-value',
            });
            this._durationBtn.set_child(this._durationLabel);
            this._durationBtn.connect('clicked', () => this._startEditing());

            // Hidden entry for editing
            this._entry = new St.Entry({
                style_class: 'pomodoro-duration-entry',
                visible: false,
            });
            this._entry.clutter_text.connect('activate', () => this._finishEditing());
            this._entry.clutter_text.connect('key-focus-out', () =>
                this._finishEditing()
            );

            this._plusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({text: '+'}),
            });
            this._plusBtn.connect('clicked', () =>
                this._adjustDuration(DurationLimits.STEP)
            );

            box.add_child(this._labelWidget);
            box.add_child(this._resetBtn);
            box.add_child(this._minusBtn);
            box.add_child(this._durationBtn);
            box.add_child(this._entry);
            box.add_child(this._plusBtn);
            this.add_child(box);

            this._updateDisplay();

            this._settingsChangedId = this._settings.connect(
                `changed::${settingsKey}`,
                () => {
                    if (!this._isEditing)
                        this._updateDisplay();
                }
            );
        }

        _startEditing() {
            this._isEditing = true;
            this._durationBtn.visible = false;
            this._entry.visible = true;
            this._entry.text = this._durationLabel.text;
            this._entry.grab_key_focus();
            this._entry.clutter_text.set_selection(0, -1);
        }

        _finishEditing() {
            if (!this._isEditing)
                return;
            this._isEditing = false;

            const text = this._entry.text.trim();
            const seconds = this._parseTimeInput(text);

            if (
                seconds !== null &&
        seconds >= DurationLimits.MIN &&
        seconds <= DurationLimits.MAX
            )
                this._settings.set_int(this._settingsKey, seconds);

            this._entry.visible = false;
            this._durationBtn.visible = true;
            this._updateDisplay();
        }

        _parseTimeInput(text) {
            // Accept MM:SS or just MM format
            const colonMatch = text.match(/^(\d{1,2}):(\d{1,2})$/);
            if (colonMatch) {
                const mins = parseInt(colonMatch[1], 10);
                const secs = parseInt(colonMatch[2], 10);
                if (mins >= 0 && mins <= 90 && secs >= 0 && secs < 60)
                    return mins * 60 + secs;

                return null;
            }

            // Just minutes
            const minsMatch = text.match(/^(\d{1,2})$/);
            if (minsMatch) {
                const mins = parseInt(minsMatch[1], 10);
                if (mins >= 0 && mins <= 90)
                    return mins * 60;
            }

            return null;
        }

        _resetToDefault() {
            this._settings.set_int(this._settingsKey, this._defaultValue);
        }

        _adjustDuration(delta) {
            const current = this._settings.get_int(this._settingsKey);
            const newValue = Math.max(
                DurationLimits.MIN,
                Math.min(DurationLimits.MAX, current + delta)
            );
            this._settings.set_int(this._settingsKey, newValue);
        }

        _updateDisplay() {
            const seconds = this._settings.get_int(this._settingsKey);
            this._durationLabel.text = formatTime(seconds);
        }

        destroy() {
            this._settings?.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
            super.destroy();
        }
    }
);

// Interval count adjustment menu item with +/- buttons
const IntervalCountMenuItem = GObject.registerClass(
    {GTypeName: 'PomodoroTimerIntervalCountMenuItem'},
    class IntervalCountMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(settings) {
            super._init({reactive: false});
            this._settings = settings;

            const box = new St.BoxLayout({
                x_expand: true,
                style_class: 'pomodoro-duration-row',
            });

            this._labelWidget = new St.Label({
                text: 'Intervals:',
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style_class: 'pomodoro-duration-label',
            });

            this._resetBtn = new St.Button({
                style_class: 'pomodoro-adjust-button pomodoro-reset-btn',
                child: new St.Label({text: '↺'}),
            });
            this._resetBtn.connect('clicked', () => this._resetToDefault());

            this._minusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({text: '−'}),
            });
            this._minusBtn.connect('clicked', () => this._adjust(-1));

            this._valueLabel = new St.Label({
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'pomodoro-duration-value',
            });
            this._updateDisplay();

            this._plusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({text: '+'}),
            });
            this._plusBtn.connect('clicked', () => this._adjust(1));

            box.add_child(this._labelWidget);
            box.add_child(this._resetBtn);
            box.add_child(this._minusBtn);
            box.add_child(this._valueLabel);
            box.add_child(this._plusBtn);
            this.add_child(box);

            this._settingsChangedId = this._settings.connect(
                'changed::intervals-per-set',
                () => {
                    this._updateDisplay();
                }
            );
        }

        _resetToDefault() {
            this._settings.set_int('intervals-per-set', 4);
        }

        _adjust(delta) {
            const current = this._settings.get_int('intervals-per-set');
            const newValue = Math.max(1, Math.min(10, current + delta));
            this._settings.set_int('intervals-per-set', newValue);
        }

        _updateDisplay() {
            this._valueLabel.text = this._settings
        .get_int('intervals-per-set')
        .toString();
        }

        destroy() {
            this._settings?.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
            super.destroy();
        }
    }
);

// Dialog shown when user returns from idle in "ask-on-return" mode
const AwayDialog = GObject.registerClass(
    {GTypeName: 'PomodoroTimerAwayDialog'},
    class AwayDialog extends ModalDialog.ModalDialog {
        _init(idleDuration) {
            super._init({destroyOnClose: true});

            const mins = Math.floor(idleDuration / 60);
            const secs = idleDuration % 60;
            const timeStr = mins > 0
                ? `${mins} minute${mins !== 1 ? 's' : ''}${secs > 0 ? ` ${secs}s` : ''}`
                : `${secs} second${secs !== 1 ? 's' : ''}`;

            const content = new Dialog.MessageDialogContent({
                title: 'Welcome Back!',
                description: `You were away for ${timeStr}.\nWhat should we do with this time?`,
            });
            this.contentLayout.add_child(content);

            this._choice = 'discard';

            this.addButton({
                label: 'Discard Time',
                action: () => {
                    this._choice = 'discard';
                    this.close();
                },
                default: true,
            });

            this.addButton({
                label: 'Keep as Focus Time',
                action: () => {
                    this._choice = 'keep';
                    this.close();
                },
            });
        }

        get choice() {
            return this._choice;
        }
    });

export const PomodoroIndicator = GObject.registerClass(
    {GTypeName: 'PomodoroTimerIndicator'},
    class PomodoroIndicator extends PanelMenu.Button {
        _init(settings, extensionPath, uuid, extension) {
            super._init(0.5, 'Pomodoro Timer');
            this._settings = settings;
            this._extensionPath = extensionPath;
            this._uuid = uuid;
            this._extension = extension;
            this._timer = new PomodoroTimer(settings);
            this._soundManager = new SoundManager(extensionPath, settings);
            this._suspendInhibitor = new SuspendInhibitor(settings);
            this._focusModeManager = new FocusModeManager(settings, extensionPath);
            this._dataStore = new DataStore(uuid);
            this._dataStore.load();
            this._statsTracker = new StatsTracker(this._dataStore);
            this._taskManager = new TaskManager(this._dataStore, settings);
            this._sessionStarted = false;
            this._idleMonitor = new IdleMonitor(settings);
            this._awayDialog = null;
            this._idleRemainingTime = null;
            this._awaitingReturn = false;

            this._useSystemTheme = this._settings.get_boolean('use-system-theme');

            this._buildPanelButton();

            // Clear default click gesture to allow vfunc_event to handle mouse events
            // This is required for GNOME 49+ where ClutterClickGesture intercepts button events
            this.clear_actions();

            this._buildMenu();
            this._connectTimerSignals();
            this._connectSettingsSignals();

            // Reload data from disk when popup opens (syncs with prefs changes)
            this._menuOpenId = this.menu.connect('open-state-changed', (_menu, isOpen) => {
                if (isOpen) {
                    this._dataStore.load();
                    this._updateTaskSection();
                }
            });

            // Restore session started flag for screen lock persistence
            this._sessionStarted = this._settings.get_boolean('session-started');

            this._updateUI();
            this._syncIdleMonitoring();
        }

        vfunc_event(event) {
            if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                const button = event.get_button();

                // Left click (button 1) - Toggle menu
                if (button === 1) {
                    this.menu.toggle();
                    return Clutter.EVENT_STOP;
                }

                // Right click (button 3) - Start/Pause
                if (button === 3) {
                    this._onStartPauseClicked();
                    return Clutter.EVENT_STOP;
                }

                // Middle click (button 2) - Skip
                if (button === 2) {
                    this._timer.skip();
                    return Clutter.EVENT_STOP;
                }
            }

            return Clutter.EVENT_PROPAGATE;
        }

        _buildPanelButton() {
            const box = new St.BoxLayout({
                style_class: 'panel-status-menu-box pomodoro-panel-box',
            });

            const iconPath = GLib.build_filenamev([
                this._extensionPath,
                'assets',
                'images',
                'fruit.png',
            ]);
            const iconFile = Gio.File.new_for_path(iconPath);
            this._icon = new St.Icon({
                gicon: Gio.FileIcon.new(iconFile),
                style_class: 'system-status-icon pomodoro-icon',
            });

            this._timerLabel = new St.Label({
                text: '25:00',
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'pomodoro-timer-label',
            });

            box.add_child(this._icon);
            box.add_child(this._timerLabel);
            this.add_child(box);
        }

        _buildMenu() {
            // Status indicator
            const statusBoxItem = new PopupMenu.PopupBaseMenuItem({
                reactive: false,
            });
            const statusBox = new St.BoxLayout({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            });
            this._statusLabel = new St.Label({
                text: 'Work',
                style_class: this._useSystemTheme
                    ? 'pomodoro-status-box-themed' : 'pomodoro-status-box',
            });
            statusBox.add_child(this._statusLabel);
            statusBoxItem.add_child(statusBox);
            this.menu.addMenuItem(statusBoxItem);

            // Interval counter
            const intervalBoxItem = new PopupMenu.PopupBaseMenuItem({
                reactive: false,
            });
            const intervalBox = new St.BoxLayout({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            });
            this._intervalCountLabel = new St.Label({
                text: 'Pomodoro 1/4',
                style_class: 'pomodoro-interval-label',
            });
            intervalBox.add_child(this._intervalCountLabel);
            intervalBoxItem.add_child(intervalBox);
            this.menu.addMenuItem(intervalBoxItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Control buttons
            this._controlsSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._controlsSection);

            // Row 1: Start/Pause + Skip
            const row1Item = new PopupMenu.PopupBaseMenuItem({reactive: false});
            const row1Box = new St.BoxLayout({
                style_class: 'pomodoro-button-row',
                x_expand: true,
            });

            this._startPauseBtn = new St.Button({
                label: 'Start',
                style_class: this._themedBtnClass('pomodoro-btn-primary'),
                x_expand: true,
            });
            this._startPauseBtn.connect('clicked', () => {
                this._onStartPauseClicked();
            });

            this._skipBtn = new St.Button({
                label: 'Skip',
                style_class: this._themedBtnClass('pomodoro-btn-secondary'),
                x_expand: true,
            });
            this._skipBtn.connect('clicked', () => {
                this._timer.skip();
            });

            row1Box.add_child(this._startPauseBtn);
            row1Box.add_child(this._skipBtn);
            row1Item.add_child(row1Box);
            this._controlsSection.addMenuItem(row1Item);

            // Row 2: Reset + Reset All
            const row2Item = new PopupMenu.PopupBaseMenuItem({reactive: false});
            const row2Box = new St.BoxLayout({
                style_class: 'pomodoro-button-row',
                x_expand: true,
            });

            this._resetBtn = new St.Button({
                label: 'Reset',
                style_class: this._themedBtnClass('pomodoro-btn-warning'),
                x_expand: true,
            });
            this._resetBtn.connect('clicked', () => {
                this._timer.reset();
            });

            this._fullResetBtn = new St.Button({
                label: 'Reset All',
                style_class: this._themedBtnClass('pomodoro-btn-danger'),
                x_expand: true,
            });
            this._fullResetBtn.connect('clicked', () => {
                this._sessionStarted = false;
                this._settings.set_boolean('session-started', false);
                this._timer.fullReset();
            });

            row2Box.add_child(this._resetBtn);
            row2Box.add_child(this._fullResetBtn);
            row2Item.add_child(row2Box);
            this._controlsSection.addMenuItem(row2Item);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Duration adjustments
            this._durationsSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._durationsSection);

            this._workDurationItem = new DurationAdjustMenuItem(
                'Work:',
                'work-duration',
                this._settings,
                this._timer,
                1500
            );
            this._durationsSection.addMenuItem(this._workDurationItem);

            this._shortBreakDurationItem = new DurationAdjustMenuItem(
                'Short Break:',
                'short-break-duration',
                this._settings,
                this._timer,
                300
            );
            this._durationsSection.addMenuItem(this._shortBreakDurationItem);

            this._longBreakDurationItem = new DurationAdjustMenuItem(
                'Long Break:',
                'long-break-duration',
                this._settings,
                this._timer,
                900
            );
            this._durationsSection.addMenuItem(this._longBreakDurationItem);

            this._intervalsPerSetItem = new IntervalCountMenuItem(this._settings);
            this._durationsSection.addMenuItem(this._intervalsPerSetItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Current task section
            this._taskSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._taskSection);
            this._buildTaskSection();

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Prefs button
            const prefsItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
            this._prefsBtn = new St.Button({
                label: 'Settings / Stats / Tasks',
                style_class: this._themedBtnClass('pomodoro-btn-secondary'),
                x_expand: true,
            });
            this._prefsBtn.connect('clicked', () => {
                this.menu.close();
                this._extension.openPreferences();
            });
            prefsItem.add_child(this._prefsBtn);
            this.menu.addMenuItem(prefsItem);
        }

        _buildTaskSection() {
            this._taskSection.removeAll();

            const currentTask = this._taskManager.getCurrentTask();

            if (currentTask) {
                // Task info row
                const taskInfoItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
                const taskInfoBox = new St.BoxLayout({
                    x_expand: true,
                    style_class: 'pomodoro-task-indicator',
                });

                taskInfoBox.add_child(new St.Icon({
                    icon_name: 'emblem-documents-symbolic',
                    icon_size: 14,
                    style_class: 'pomodoro-task-icon',
                }));

                const titleLabel = new St.Label({
                    text: currentTask.title,
                    x_expand: true,
                    y_align: Clutter.ActorAlign.CENTER,
                    style_class: 'pomodoro-task-title',
                });
                titleLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
                taskInfoBox.add_child(titleLabel);

                taskInfoBox.add_child(new St.Label({
                    text: `${currentTask.pomodorosCompleted}/${currentTask.pomodorosEstimated}`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style_class: 'pomodoro-task-progress',
                }));

                taskInfoItem.add_child(taskInfoBox);
                this._taskSection.addMenuItem(taskInfoItem);

                // Task action buttons
                const taskActionsItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
                const taskActionsBox = new St.BoxLayout({
                    style_class: 'pomodoro-button-row',
                    x_expand: true,
                });

                const completeBtn = new St.Button({
                    label: '✓ Complete',
                    style_class: this._themedBtnClass('pomodoro-btn-primary'),
                    x_expand: true,
                });
                completeBtn.connect('clicked', () => {
                    this._taskManager.completeTask(currentTask.id);
                    this._updateTaskSection();
                });

                taskActionsBox.add_child(completeBtn);
                taskActionsItem.add_child(taskActionsBox);
                this._taskSection.addMenuItem(taskActionsItem);
            }

            // Change/select task submenu
            const activeTasks = this._taskManager.getActiveTasks();
            if (activeTasks.length > 0) {
                const changeLabel = currentTask ? '↻ Change Task' : 'Select Task';
                const changeItem = new PopupMenu.PopupSubMenuMenuItem(changeLabel);
                const currentId = currentTask ? currentTask.id : '';

                for (const task of activeTasks) {
                    const taskItem = new PopupMenu.PopupMenuItem(
                        `${task.title}  (${task.pomodorosCompleted}/${task.pomodorosEstimated})`
                    );
                    if (task.id === currentId)
                        taskItem.setOrnament(PopupMenu.Ornament.DOT);
                    else
                        taskItem.setOrnament(PopupMenu.Ornament.NONE);

                    taskItem.connect('activate', () => {
                        this._taskManager.setCurrentTask(task.id);
                        this._updateTaskSection();
                    });
                    changeItem.menu.addMenuItem(taskItem);
                }

                if (currentTask) {
                    changeItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    const clearItem = new PopupMenu.PopupMenuItem('No Task');
                    clearItem.connect('activate', () => {
                        this._taskManager.setCurrentTask('');
                        this._updateTaskSection();
                    });
                    changeItem.menu.addMenuItem(clearItem);
                }

                this._taskSection.addMenuItem(changeItem);
            } else if (!currentTask) {
                const emptyItem = new PopupMenu.PopupMenuItem('No tasks', {reactive: false});
                emptyItem.setSensitive(false);
                this._taskSection.addMenuItem(emptyItem);
            }
        }

        _updateTaskSection() {
            if (this._taskRebuildId)
                return;
            this._taskRebuildId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this._taskRebuildId = null;
                this._buildTaskSection();
                return GLib.SOURCE_REMOVE;
            });
        }

        _connectTimerSignals() {
            this._timerSignals = [];

            this._timerSignals.push(
                this._timer.connect('tick', (timer, remaining) => {
                    this._timerLabel.text = formatTime(remaining);
                    this._updateIntervalLabel();
                })
            );

            this._timerSignals.push(
                this._timer.connect('state-changed', (timer, oldState, newState) => {
                    this._updateUI();
                    if (newState === TimerState.RUNNING && oldState === TimerState.IDLE) {
                        this._soundManager.playStartSound();
                        this._soundManager.startTickLoop();
                        this._suspendInhibitor.inhibit();
                        if (this._timer.intervalType === IntervalType.WORK)
                            this._focusModeManager.activate();
                    } else if (
                        newState === TimerState.RUNNING &&
            oldState === TimerState.PAUSED
                    ) {
                        this._soundManager.startTickLoop();
                        this._suspendInhibitor.inhibit();
                        if (this._timer.intervalType === IntervalType.WORK)
                            this._focusModeManager.activate();
                    } else if (
                        newState === TimerState.PAUSED ||
            newState === TimerState.IDLE
                    ) {
                        this._soundManager.stopTickLoop();
                        this._suspendInhibitor.uninhibit();
                        this._focusModeManager.deactivate();
                    }
                    this._syncIdleMonitoring();
                })
            );

            this._timerSignals.push(
                this._timer.connect('interval-changed', (_timer, intervalType) => {
                    this._updateUI();
                    if (intervalType === IntervalType.WORK &&
                      this._timer.state === TimerState.RUNNING)
                        this._focusModeManager.activate();
                    else
                        this._focusModeManager.deactivate();
                })
            );

            this._timerSignals.push(
                this._timer.connect('interval-completed', (_timer, intervalType) => {
                    this._soundManager.playCompleteSound();
                    if (intervalType === IntervalType.WORK) {
                        const currentTask = this._taskManager.getCurrentTask();
                        const taskId = currentTask ? currentTask.id : null;
                        const dur = this._settings.get_int('work-duration');
                        this._statsTracker.logSession(dur, taskId);
                        if (taskId) {
                            this._taskManager.incrementPomodoro(taskId);
                            if (this._settings.get_boolean('auto-complete-tasks')) {
                                const task = this._taskManager.getCurrentTask();
                                if (task && !task.repeated && task.pomodorosCompleted >= task.pomodorosEstimated) {
                                    this._taskManager.completeTask(taskId);
                                    if (this._settings.get_boolean('notify-enabled'))
                                        Main.notify('Pomodoro Timer', `Task "${task.title}" completed!`);
                                }
                            }
                        }
                        this._updateTaskSection();

                        if (this._settings.get_boolean('notify-enabled')) {
                            const total = this._settings.get_int('intervals-per-set');
                            const done = this._timer.completedWorkIntervals + 1;
                            if (done >= total)
                                Main.notify('Pomodoro Timer', 'All sessions complete! Time for a well-deserved long break.');
                            else
                                Main.notify('Pomodoro Timer', 'Work session complete, good job! Time for a short break.');
                        }
                    } else if (this._settings.get_boolean('notify-enabled')) {
                        if (intervalType === IntervalType.SHORT_BREAK)
                            Main.notify('Pomodoro Timer', 'Break is over. Ready for the next session!');
                        else if (intervalType === IntervalType.LONG_BREAK)
                            Main.notify('Pomodoro Timer', 'Long break is over. A new set begins!');
                    }
                })
            );

            this._timerSignals.push(
                this._timer.connect('set-completed', () => {

                })
            );
        }

        _connectSettingsSignals() {
            this._settingsSignals = [];
            const updateUI = () => this._updateUI();

            this._settingsSignals.push(
                this._settings.connect('changed::show-icon', updateUI)
            );
            this._settingsSignals.push(
                this._settings.connect('changed::show-timer-always', updateUI)
            );
            this._settingsSignals.push(
                this._settings.connect('changed::current-task-id', () => {
                    this._dataStore.load();
                    this._updateTaskSection();
                })
            );
            this._settingsSignals.push(
                this._settings.connect('changed::use-system-theme', () => {
                    this._useSystemTheme = this._settings.get_boolean('use-system-theme');
                    this._applyTheme();
                })
            );
            this._settingsSignals.push(
                this._settings.connect('changed::idle-detection-enabled', () => {
                    this._syncIdleMonitoring();
                })
            );
            this._settingsSignals.push(
                this._settings.connect('changed::idle-detection-mode', () => {
                    this._syncIdleMonitoring();
                })
            );
            this._settingsSignals.push(
                this._settings.connect('changed::idle-threshold', () => {
                    this._syncIdleMonitoring();
                })
            );
        }

        // --- Idle Detection ---

        _shouldMonitorIdle() {
            return this._settings.get_boolean('idle-detection-enabled') &&
              this._timer.state === TimerState.RUNNING;
        }

        _syncIdleMonitoring() {
            // Don't interrupt while waiting for user to return in ask-on-return mode
            if (this._awaitingReturn) {
                if (!this._settings.get_boolean('idle-detection-enabled')) {
                    this._awaitingReturn = false;
                    this._idleRemainingTime = null;
                    this._idleMonitor.stop();
                }
                return;
            }

            if (this._shouldMonitorIdle()) {
                this._idleMonitor.stop();
                this._idleMonitor.start(
                    () => this._onUserIdle(),
                    idleDuration => this._onUserReturn(idleDuration)
                );
            } else {
                this._idleMonitor.stop();
            }
        }

        _onUserIdle() {
            const mode = this._settings.get_string('idle-detection-mode');

            if (mode === 'auto-pause') {
                this._timer.pause();
            } else if (mode === 'ask-on-return') {
                this._idleRemainingTime = this._timer.remainingTime;
                this._awaitingReturn = true;
                this._timer.pause();
            }
        }

        _onUserReturn(idleDuration) {
            const mode = this._settings.get_string('idle-detection-mode');

            if (mode === 'auto-pause') {
                if (this._settings.get_boolean('notify-enabled'))
                    Main.notify('Pomodoro Timer', 'Timer paused while you were away.');
            } else if (mode === 'ask-on-return') {
                this._awaitingReturn = false;
                this._showAwayDialog(idleDuration);
            }
        }

        _showAwayDialog(idleDuration) {
            if (this._awayDialog)
                return;

            // Timer is already paused from _onUserIdle
            this._awayDialog = new AwayDialog(idleDuration);
            const dialog = this._awayDialog;

            dialog.connect('closed', () => {
                const choice = dialog.choice;
                this._awayDialog = null;

                if (choice === 'keep' && this._idleRemainingTime !== null) {
                    const effectiveRemaining = this._idleRemainingTime - idleDuration;
                    this._timer.rewindTo(Math.max(1, effectiveRemaining));
                }

                this._idleRemainingTime = null;
                this._timer.resume();
            });

            this._awayDialog.open();
        }

        // Public methods for keybinding actions
        toggleTimer() {
            this._onStartPauseClicked();
        }

        skipInterval() {
            this._timer.skip();
        }

        resetTimer() {
            this._timer.reset();
        }

        resetAll() {
            this._sessionStarted = false;
            this._settings.set_boolean('session-started', false);
            this._timer.fullReset();
        }

        _onStartPauseClicked() {
            switch (this._timer.state) {
            case TimerState.IDLE:
                this._sessionStarted = true;
                this._settings.set_boolean('session-started', true);
                this._timer.start();
                break;
            case TimerState.RUNNING:
                this._timer.pause();
                break;
            case TimerState.PAUSED:
                this._timer.resume();
                break;
            }
        }

        _updateUI() {
            const state = this._timer.state;
            const intervalType = this._timer.intervalType;
            const completed = this._timer.completedWorkIntervals;
            const total = this._timer.intervalsPerSet;

            this._timerLabel.text = formatTime(this._timer.remainingTime);
            this._statusLabel.text = getIntervalDisplayName(intervalType);

            // Panel visibility based on settings and session state
            const showIcon = this._settings.get_boolean('show-icon');
            const showTimerAlways = this._settings.get_boolean('show-timer-always');

            this._icon.visible = showIcon;
            this._timerLabel.visible = showTimerAlways || this._sessionStarted;

            if (intervalType === IntervalType.WORK)
                this._intervalCountLabel.text = `Pomodoro ${completed + 1}/${total} | ${formatTime(this._timer.remainingTime)}`;
            else
                this._intervalCountLabel.text = `Pomodoro ${completed}/${total} | ${formatTime(this._timer.remainingTime)}`;

            switch (state) {
            case TimerState.IDLE:
                this._startPauseBtn.label = 'Start';
                break;
            case TimerState.RUNNING:
                this._startPauseBtn.label = 'Pause';
                break;
            case TimerState.PAUSED:
                this._startPauseBtn.label = 'Resume';
                break;
            }

            this._updateIconStyle();
        }

        _updateIntervalLabel() {
            const intervalType = this._timer.intervalType;
            const completed = this._timer.completedWorkIntervals;
            const total = this._timer.intervalsPerSet;

            if (intervalType === IntervalType.WORK)
                this._intervalCountLabel.text = `Pomodoro ${completed + 1}/${total} | ${formatTime(this._timer.remainingTime)}`;
            else
                this._intervalCountLabel.text = `Pomodoro ${completed}/${total} | ${formatTime(this._timer.remainingTime)}`;
        }

        _updateIconStyle() {
            const state = this._timer.state;
            const intervalType = this._timer.intervalType;

            this._icon.remove_style_class_name('pomodoro-work');
            this._icon.remove_style_class_name('pomodoro-break');
            this._icon.remove_style_class_name('pomodoro-paused');

            // Swap icon based on interval type
            const iconName =
        intervalType === IntervalType.WORK ? 'fruit.png' : 'coffee.png';
            const iconPath = GLib.build_filenamev([
                this._extensionPath,
                'assets',
                'images',
                iconName,
            ]);
            const iconFile = Gio.File.new_for_path(iconPath);
            this._icon.gicon = Gio.FileIcon.new(iconFile);

            if (state === TimerState.PAUSED)
                this._icon.add_style_class_name('pomodoro-paused');
            else if (intervalType === IntervalType.WORK)
                this._icon.add_style_class_name('pomodoro-work');
            else
                this._icon.add_style_class_name('pomodoro-break');
        }

        _themedBtnClass(modifier) {
            if (this._useSystemTheme)
                return `pomodoro-control-btn-themed ${modifier}`;
            return `pomodoro-control-btn ${modifier}`;
        }

        _applyTheme() {
            this._statusLabel.style_class = this._useSystemTheme
                ? 'pomodoro-status-box-themed' : 'pomodoro-status-box';

            const buttons = [
                this._startPauseBtn, this._skipBtn,
                this._resetBtn, this._fullResetBtn, this._prefsBtn,
            ];
            const btnBase = this._useSystemTheme
                ? 'pomodoro-control-btn-themed' : 'pomodoro-control-btn';
            for (const btn of buttons) {
                btn.style_class = btn.style_class
                  .replace(/pomodoro-control-btn(-themed)?/, btnBase);
            }
        }

        destroy() {
            if (this._taskRebuildId) {
                GLib.source_remove(this._taskRebuildId);
                this._taskRebuildId = null;
            }

            this._awayDialog?.close();
            this._awayDialog = null;

            this._idleMonitor?.destroy();
            this._idleMonitor = null;

            if (this._menuOpenId) {
                this.menu.disconnect(this._menuOpenId);
                this._menuOpenId = null;
            }

            this._timerSignals?.forEach(id => this._timer.disconnect(id));
            this._timerSignals = null;

            this._settingsSignals?.forEach(id => this._settings.disconnect(id));
            this._settingsSignals = null;

            this._soundManager?.destroy();
            this._soundManager = null;

            this._suspendInhibitor?.destroy();
            this._suspendInhibitor = null;

            this._focusModeManager?.destroy();
            this._focusModeManager = null;

            this._taskManager?.destroy();
            this._taskManager = null;

            this._statsTracker?.destroy();
            this._statsTracker = null;

            this._dataStore?.destroy();
            this._dataStore = null;

            this._timer?.destroy();
            this._timer = null;

            super.destroy();
        }
    }
);
