import {TaskDefaults} from './constants.js';

export class TaskManager {
    constructor(dataStore, settings) {
        this._dataStore = dataStore;
        this._settings = settings;
    }

    addTask(title, difficulty, pomodorosEstimated, repeated = false) {
        const task = {
            id: String(Date.now()),
            title,
            difficulty: Math.max(
                TaskDefaults.MIN_DIFFICULTY,
                Math.min(TaskDefaults.MAX_DIFFICULTY, difficulty || TaskDefaults.DEFAULT_DIFFICULTY)
            ),
            createdAt: new Date().toISOString(),
            completedAt: null,
            pomodorosCompleted: 0,
            pomodorosEstimated: pomodorosEstimated || TaskDefaults.DEFAULT_ESTIMATED_POMODOROS,
            repeated: !!repeated,
        };
        this._dataStore.getData().tasks.push(task);
        this._dataStore.save();
        return task;
    }

    completeTask(id) {
        const task = this._findTask(id);
        if (task) {
            if (task.repeated) {
                task.pomodorosCompleted = 0;
                this._dataStore.save();
            } else {
                task.completedAt = new Date().toISOString();
                this._dataStore.save();
                if (this._settings.get_string('current-task-id') === id)
                    this._settings.set_string('current-task-id', '');
            }
        }
    }

    deleteTask(id) {
        const data = this._dataStore.getData();
        const idx = data.tasks.findIndex(t => t.id === id);
        if (idx >= 0) {
            if (this._settings.get_string('current-task-id') === id)
                this._settings.set_string('current-task-id', '');
            data.tasks.splice(idx, 1);
            this._dataStore.save();
        }
    }

    updateTask(id, fields) {
        const task = this._findTask(id);
        if (task) {
            if (fields.title !== undefined)
                task.title = fields.title;
            if (fields.difficulty !== undefined) {
                task.difficulty = Math.max(
                    TaskDefaults.MIN_DIFFICULTY,
                    Math.min(TaskDefaults.MAX_DIFFICULTY, fields.difficulty)
                );
            }
            if (fields.pomodorosEstimated !== undefined)
                task.pomodorosEstimated = fields.pomodorosEstimated;
            if (fields.repeated !== undefined)
                task.repeated = !!fields.repeated;
            this._dataStore.save();
        }
    }

    getActiveTasks() {
        return this._dataStore.getData().tasks.filter(t => !t.completedAt);
    }

    getCompletedTasks() {
        return this._dataStore.getData().tasks
            .filter(t => t.completedAt)
            .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    }

    setCurrentTask(id) {
        this._settings.set_string('current-task-id', id || '');
    }

    getCurrentTask() {
        const id = this._settings.get_string('current-task-id');
        if (!id)
            return null;
        return this._findTask(id);
    }

    incrementPomodoro(id) {
        const task = this._findTask(id);
        if (task) {
            task.pomodorosCompleted++;
            this._dataStore.save();
        }
    }

    _findTask(id) {
        return this._dataStore.getData().tasks.find(t => t.id === id);
    }

    destroy() {
        this._dataStore = null;
        this._settings = null;
    }
}
