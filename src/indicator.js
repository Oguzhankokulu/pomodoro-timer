// Panel Indicator for Pomodoro Timer
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { TimerState, IntervalType } from './constants.js';
import { formatTime, getIntervalDisplayName } from './utils.js';
import { PomodoroTimer } from './timer.js';
import { SoundManager } from './sound.js';
import { SuspendInhibitor } from './suspendInhibitor.js';

const DURATION_STEP = 30;
const MIN_DURATION = 30;
const MAX_DURATION = 5400;

// Duration adjustment menu item with +/- buttons and editable entry
const DurationAdjustMenuItem = GObject.registerClass(
    class DurationAdjustMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(label, settingsKey, settings, timer, defaultValue) {
            super._init({ reactive: false });
            this._settingsKey = settingsKey;
            this._settings = settings;
            this._timer = timer;
            this._defaultValue = defaultValue;
            this._isEditing = false;

            const box = new St.BoxLayout({ x_expand: true, style_class: 'pomodoro-duration-row' });

            this._labelWidget = new St.Label({
                text: label,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style_class: 'pomodoro-duration-label',
            });

            this._resetBtn = new St.Button({
                style_class: 'pomodoro-adjust-button pomodoro-reset-btn',
                child: new St.Label({ text: '↺' }),
            });
            this._resetBtn.connect('clicked', () => this._resetToDefault());

            this._minusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({ text: '−' }),
            });
            this._minusBtn.connect('clicked', () => this._adjustDuration(-DURATION_STEP));

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
            this._entry.clutter_text.connect('key-focus-out', () => this._finishEditing());

            this._plusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({ text: '+' }),
            });
            this._plusBtn.connect('clicked', () => this._adjustDuration(DURATION_STEP));

            box.add_child(this._labelWidget);
            box.add_child(this._resetBtn);
            box.add_child(this._minusBtn);
            box.add_child(this._durationBtn);
            box.add_child(this._entry);
            box.add_child(this._plusBtn);
            this.add_child(box);

            this._updateDisplay();

            this._settingsChangedId = this._settings.connect(`changed::${settingsKey}`, () => {
                if (!this._isEditing) this._updateDisplay();
            });
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
            if (!this._isEditing) return;
            this._isEditing = false;

            const text = this._entry.text.trim();
            const seconds = this._parseTimeInput(text);

            if (seconds !== null && seconds >= MIN_DURATION && seconds <= MAX_DURATION) {
                this._settings.set_int(this._settingsKey, seconds);
            }

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
                if (mins >= 0 && mins <= 90 && secs >= 0 && secs < 60) {
                    return mins * 60 + secs;
                }
                return null;
            }

            // Just minutes
            const minsMatch = text.match(/^(\d{1,2})$/);
            if (minsMatch) {
                const mins = parseInt(minsMatch[1], 10);
                if (mins >= 0 && mins <= 90) {
                    return mins * 60;
                }
            }

            return null;
        }

        _resetToDefault() {
            this._settings.set_int(this._settingsKey, this._defaultValue);
        }

        _adjustDuration(delta) {
            let current = this._settings.get_int(this._settingsKey);
            let newValue = Math.max(MIN_DURATION, Math.min(MAX_DURATION, current + delta));
            this._settings.set_int(this._settingsKey, newValue);
        }

        _updateDisplay() {
            const seconds = this._settings.get_int(this._settingsKey);
            this._durationLabel.text = formatTime(seconds);
        }

        destroy() {
            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = null;
            }
            super.destroy();
        }
    });

// Interval count adjustment menu item with +/- buttons
const IntervalCountMenuItem = GObject.registerClass(
    class IntervalCountMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(settings) {
            super._init({ reactive: false });
            this._settings = settings;

            const box = new St.BoxLayout({ x_expand: true, style_class: 'pomodoro-duration-row' });

            this._labelWidget = new St.Label({
                text: 'Intervals:',
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style_class: 'pomodoro-duration-label',
            });

            this._resetBtn = new St.Button({
                style_class: 'pomodoro-adjust-button pomodoro-reset-btn',
                child: new St.Label({ text: '↺' }),
            });
            this._resetBtn.connect('clicked', () => this._resetToDefault());

            this._minusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({ text: '−' }),
            });
            this._minusBtn.connect('clicked', () => this._adjust(-1));

            this._valueLabel = new St.Label({
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'pomodoro-duration-value',
            });
            this._updateDisplay();

            this._plusBtn = new St.Button({
                style_class: 'pomodoro-adjust-button',
                child: new St.Label({ text: '+' }),
            });
            this._plusBtn.connect('clicked', () => this._adjust(1));

            box.add_child(this._labelWidget);
            box.add_child(this._resetBtn);
            box.add_child(this._minusBtn);
            box.add_child(this._valueLabel);
            box.add_child(this._plusBtn);
            this.add_child(box);

            this._settingsChangedId = this._settings.connect('changed::intervals-per-set', () => {
                this._updateDisplay();
            });
        }

        _resetToDefault() {
            this._settings.set_int('intervals-per-set', 4);
        }

        _adjust(delta) {
            let current = this._settings.get_int('intervals-per-set');
            let newValue = Math.max(1, Math.min(10, current + delta));
            this._settings.set_int('intervals-per-set', newValue);
        }

        _updateDisplay() {
            this._valueLabel.text = this._settings.get_int('intervals-per-set').toString();
        }

        destroy() {
            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = null;
            }
            super.destroy();
        }
    });

export const PomodoroIndicator = GObject.registerClass(
    class PomodoroIndicator extends PanelMenu.Button {
        _init(settings, extensionPath, uuid) {
            super._init(0.0, 'Pomodoro Timer');
            this._settings = settings;
            this._extensionPath = extensionPath;
            this._uuid = uuid;
            this._timer = new PomodoroTimer(settings);
            this._soundManager = new SoundManager(extensionPath, settings);
            this._suspendInhibitor = new SuspendInhibitor(settings);
            this._sessionStarted = false;

            this._buildPanelButton();
            this._buildMenu();
            this._connectTimerSignals();
            this._connectSettingsSignals();
            this._updateUI();

            // Mouse button shortcuts
            this.connect('button-press-event', (actor, event) => {
                const button = event.get_button();

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

                return Clutter.EVENT_PROPAGATE;
            });
        }

        _buildPanelButton() {
            const box = new St.BoxLayout({ style_class: 'panel-status-menu-box pomodoro-panel-box' });

            const iconPath = GLib.build_filenamev([this._extensionPath, 'assets', 'images', 'fruit.png']);
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
            const statusBoxItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            const statusBox = new St.BoxLayout({ x_expand: true, x_align: Clutter.ActorAlign.CENTER });
            this._statusLabel = new St.Label({ text: 'Work', style_class: 'pomodoro-status-box' });
            statusBox.add_child(this._statusLabel);
            statusBoxItem.add_child(statusBox);
            this.menu.addMenuItem(statusBoxItem);

            // Interval counter
            const intervalBoxItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            const intervalBox = new St.BoxLayout({ x_expand: true, x_align: Clutter.ActorAlign.CENTER });
            this._intervalCountLabel = new St.Label({ text: 'Pomodoro 1/4', style_class: 'pomodoro-interval-label' });
            intervalBox.add_child(this._intervalCountLabel);
            intervalBoxItem.add_child(intervalBox);
            this.menu.addMenuItem(intervalBoxItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Control buttons
            this._controlsSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._controlsSection);

            // Row 1: Start/Pause + Skip
            const row1Item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            const row1Box = new St.BoxLayout({ style_class: 'pomodoro-button-row', x_expand: true });

            this._startPauseBtn = new St.Button({
                label: 'Start',
                style_class: 'pomodoro-control-btn pomodoro-btn-primary',
                x_expand: true,
            });
            this._startPauseBtn.connect('clicked', () => {
                this._onStartPauseClicked();
            });

            this._skipBtn = new St.Button({
                label: 'Skip',
                style_class: 'pomodoro-control-btn pomodoro-btn-secondary',
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
            const row2Item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            const row2Box = new St.BoxLayout({ style_class: 'pomodoro-button-row', x_expand: true });

            this._resetBtn = new St.Button({
                label: 'Reset',
                style_class: 'pomodoro-control-btn pomodoro-btn-warning',
                x_expand: true,
            });
            this._resetBtn.connect('clicked', () => {
                this._timer.reset();
            });

            this._fullResetBtn = new St.Button({
                label: 'Reset All',
                style_class: 'pomodoro-control-btn pomodoro-btn-danger',
                x_expand: true,
            });
            this._fullResetBtn.connect('clicked', () => {
                this._sessionStarted = false;
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

            this._workDurationItem = new DurationAdjustMenuItem('Work:', 'work-duration', this._settings, this._timer, 1500);
            this._durationsSection.addMenuItem(this._workDurationItem);

            this._shortBreakDurationItem = new DurationAdjustMenuItem('Short Break:', 'short-break-duration', this._settings, this._timer, 300);
            this._durationsSection.addMenuItem(this._shortBreakDurationItem);

            this._longBreakDurationItem = new DurationAdjustMenuItem('Long Break:', 'long-break-duration', this._settings, this._timer, 900);
            this._durationsSection.addMenuItem(this._longBreakDurationItem);

            this._intervalsPerSetItem = new IntervalCountMenuItem(this._settings);
            this._durationsSection.addMenuItem(this._intervalsPerSetItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Settings button
            this._settingsItem = new PopupMenu.PopupMenuItem('Settings');
            this._settingsItem.connect('activate', () => {
                try {
                    GLib.spawn_command_line_async(`gnome-extensions prefs ${this._uuid}`);
                } catch (e) {
                    console.error(`Pomodoro: Failed to open settings: ${e.message}`);
                }
            });
            this.menu.addMenuItem(this._settingsItem);
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
                    } else if (newState === TimerState.RUNNING && oldState === TimerState.PAUSED) {
                        this._soundManager.startTickLoop();
                        this._suspendInhibitor.inhibit();
                    } else if (newState === TimerState.PAUSED || newState === TimerState.IDLE) {
                        this._soundManager.stopTickLoop();
                        this._suspendInhibitor.uninhibit();
                    }
                })
            );

            this._timerSignals.push(
                this._timer.connect('interval-changed', () => {
                    this._updateUI();
                })
            );

            this._timerSignals.push(
                this._timer.connect('interval-completed', (timer, intervalType) => {
                    this._soundManager.playCompleteSound();
                })
            );

            this._timerSignals.push(
                this._timer.connect('set-completed', () => {
                    console.log('Pomodoro: Full set completed!');
                })
            );
        }

        _connectSettingsSignals() {
            this._settingsSignals = [];
            const updateUI = () => this._updateUI();

            this._settingsSignals.push(this._settings.connect('changed::show-icon', updateUI));
            this._settingsSignals.push(this._settings.connect('changed::show-timer-always', updateUI));
        }

        _onStartPauseClicked() {
            switch (this._timer.state) {
                case TimerState.IDLE:
                    this._sessionStarted = true;
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

            if (intervalType === IntervalType.WORK) {
                this._intervalCountLabel.text = `Pomodoro ${completed + 1}/${total} | ${formatTime(this._timer.remainingTime)}`;
            } else {
                this._intervalCountLabel.text = `Pomodoro ${completed}/${total} | ${formatTime(this._timer.remainingTime)}`;
            }

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

            if (intervalType === IntervalType.WORK) {
                this._intervalCountLabel.text = `Pomodoro ${completed + 1}/${total} | ${formatTime(this._timer.remainingTime)}`;
            } else {
                this._intervalCountLabel.text = `Pomodoro ${completed}/${total} | ${formatTime(this._timer.remainingTime)}`;
            }
        }

        _updateIconStyle() {
            const state = this._timer.state;
            const intervalType = this._timer.intervalType;

            this._icon.remove_style_class_name('pomodoro-work');
            this._icon.remove_style_class_name('pomodoro-break');
            this._icon.remove_style_class_name('pomodoro-paused');

            // Swap icon based on interval type
            const iconName = (intervalType === IntervalType.WORK) ? 'fruit.png' : 'coffee.png';
            const iconPath = GLib.build_filenamev([this._extensionPath, 'assets', 'images', iconName]);
            const iconFile = Gio.File.new_for_path(iconPath);
            this._icon.gicon = Gio.FileIcon.new(iconFile);

            if (state === TimerState.PAUSED) {
                this._icon.add_style_class_name('pomodoro-paused');
            } else if (intervalType === IntervalType.WORK) {
                this._icon.add_style_class_name('pomodoro-work');
            } else {
                this._icon.add_style_class_name('pomodoro-break');
            }
        }

        destroy() {
            if (this._timerSignals) {
                this._timerSignals.forEach(id => this._timer.disconnect(id));
                this._timerSignals = null;
            }

            if (this._settingsSignals) {
                this._settingsSignals.forEach(id => this._settings.disconnect(id));
                this._settingsSignals = null;
            }

            if (this._soundManager) {
                this._soundManager.destroy();
                this._soundManager = null;
            }

            if (this._suspendInhibitor) {
                this._suspendInhibitor.destroy();
                this._suspendInhibitor = null;
            }

            if (this._timer) {
                this._timer.destroy();
                this._timer = null;
            }

            super.destroy();
        }
    });