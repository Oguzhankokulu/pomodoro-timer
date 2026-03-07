export class StatsTracker {
    constructor(dataStore) {
        this._dataStore = dataStore;
    }

    logSession(durationSeconds, taskId) {
        const now = new Date();
        this._dataStore.getData().sessions.push({
            date: now.toISOString().split('T')[0],
            startTime: now.toTimeString().split(' ')[0],
            durationSeconds,
            taskId: taskId || null,
        });
        this._dataStore.save();
    }

    getTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        const sessions = this._sessions().filter(s => s.date === today);
        return {
            pomodoroCount: sessions.length,
            totalMinutes: Math.round(
                sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
            ),
        };
    }

    getWeekStats() {
        const result = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const sessions = this._sessions().filter(s => s.date === dateStr);
            result.push({
                date: dateStr,
                label: d.toLocaleDateString('en', {weekday: 'short'}),
                totalMinutes: Math.round(
                    sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
                ),
                pomodoroCount: sessions.length,
            });
        }
        return result;
    }

    getMonthStats() {
        const result = [];
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - i * 7);

            const startStr = weekStart.toISOString().split('T')[0];
            const endStr = weekEnd.toISOString().split('T')[0];

            const sessions = this._sessions().filter(
                s => s.date >= startStr && s.date <= endStr
            );
            result.push({
                label: `W${4 - i}`,
                totalMinutes: Math.round(
                    sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
                ),
                pomodoroCount: sessions.length,
            });
        }
        return result;
    }

    getYearStats() {
        const result = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const prefix = `${year}-${month}`;

            const sessions = this._sessions().filter(
                s => s.date.startsWith(prefix)
            );
            result.push({
                label: d.toLocaleDateString('en', {month: 'short'}),
                totalMinutes: Math.round(
                    sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
                ),
                pomodoroCount: sessions.length,
            });
        }
        return result;
    }

    getAllTimeStats() {
        const sessions = this._sessions();
        const totalHours = sessions.reduce(
            (sum, s) => sum + s.durationSeconds, 0
        ) / 3600;

        const dates = [...new Set(sessions.map(s => s.date))].sort();
        let currentStreak = 0;
        let bestStreak = 0;
        let streak = 0;

        for (let i = 0; i < dates.length; i++) {
            if (i === 0) {
                streak = 1;
            } else {
                const prev = new Date(dates[i - 1]);
                const curr = new Date(dates[i]);
                const diff = (curr - prev) / (1000 * 60 * 60 * 24);
                streak = diff === 1 ? streak + 1 : 1;
            }
            bestStreak = Math.max(bestStreak, streak);
        }

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (dates.length > 0) {
            const lastDate = dates[dates.length - 1];
            if (lastDate === today || lastDate === yesterdayStr) {
                let s = 1;
                for (let i = dates.length - 2; i >= 0; i--) {
                    const prev = new Date(dates[i]);
                    const curr = new Date(dates[i + 1]);
                    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
                    if (diff === 1)
                        s++;
                    else
                        break;
                }
                currentStreak = s;
            }
        }

        return {
            totalSessions: sessions.length,
            totalHours: Math.round(totalHours * 10) / 10,
            currentStreak,
            bestStreak,
        };
    }

    getEfficiency(period) {
        const tasks = this._dataStore.getData().tasks;

        let filteredTasks;
        if (period === 'all-time') {
            filteredTasks = tasks.filter(t => t.completedAt);
        } else {
            const cutoff = this._getCutoffDate(period);
            filteredTasks = tasks.filter(
                t => t.completedAt && t.completedAt >= cutoff
            );
        }

        if (filteredTasks.length === 0)
            return 0;

        const difficultySum = filteredTasks.reduce(
            (sum, t) => sum + (t.difficulty || 5), 0
        );
        const pomodoroSum = filteredTasks.reduce(
            (sum, t) => sum + (t.pomodorosCompleted || 1), 0
        );

        return Math.round((difficultySum / pomodoroSum) * 10) / 10;
    }

    getTaskCompletionStats() {
        const tasks = this._dataStore.getData().tasks;
        const completed = tasks.filter(t => t.completedAt);
        if (completed.length === 0)
            return {totalCompleted: 0, avgDifficulty: 0, avgPomodoros: 0};

        const avgDiff = completed.reduce(
            (s, t) => s + (t.difficulty || 5), 0
        ) / completed.length;
        const avgPom = completed.reduce(
            (s, t) => s + (t.pomodorosCompleted || 0), 0
        ) / completed.length;

        return {
            totalCompleted: completed.length,
            avgDifficulty: Math.round(avgDiff * 10) / 10,
            avgPomodoros: Math.round(avgPom * 10) / 10,
        };
    }

    _sessions() {
        return this._dataStore.getData().sessions;
    }

    _getCutoffDate(period) {
        const now = new Date();
        if (period === 'day')
            return now.toISOString().split('T')[0];
        if (period === 'week') {
            now.setDate(now.getDate() - 7);
            return now.toISOString().split('T')[0];
        }
        if (period === 'month') {
            now.setMonth(now.getMonth() - 1);
            return now.toISOString().split('T')[0];
        }
        return '1970-01-01';
    }

    destroy() {
        this._dataStore = null;
    }
}
