// Suspend Inhibitor for Pomodoro Timer
// Uses DBus org.gnome.SessionManager to prevent auto-suspend
import Gio from 'gi://Gio';



// Inhibit flags
const INHIBIT_SUSPEND = 4; // Inhibit suspending the session or computer
const INHIBIT_IDLE = 8; // Inhibit the session being marked as idle

export class SuspendInhibitor {
    constructor(settings) {
        this._settings = settings;
        this._inhibitorCookie = null;
        this._isInhibited = false;

        const DBusSessionManagerIface = `<node>
            <interface name="org.gnome.SessionManager">
                <method name="Inhibit">
                    <arg type="s" direction="in" />
                    <arg type="u" direction="in" />
                    <arg type="s" direction="in" />
                    <arg type="u" direction="in" />
                    <arg type="u" direction="out" />
                </method>
                <method name="Uninhibit">
                    <arg type="u" direction="in" />
                </method>
            </interface>
        </node>`;

        const DBusSessionManagerProxy = Gio.DBusProxy.makeProxyWrapper(
            DBusSessionManagerIface
        );

        this._sessionManager = new DBusSessionManagerProxy(
            Gio.DBus.session,
            'org.gnome.SessionManager',
            '/org/gnome/SessionManager'
        );
    }

    get enabled() {
        return this._settings.get_boolean('suspend-inhibitor-enabled');
    }

    get isInhibited() {
        return this._isInhibited;
    }

    inhibit() {
        if (!this.enabled || this._isInhibited)
            return;

        this._sessionManager.InhibitRemote(
            'pomodoro-timer',
            0,
            'Pomodoro Timer is running',
            INHIBIT_IDLE | INHIBIT_SUSPEND,
            (cookie, error) => {
                if (error) {
                    console.error(`Pomodoro: Failed to add inhibitor: ${error.message}`);
                    return;
                }
                this._inhibitorCookie = cookie;
                this._isInhibited = true;
            }
        );
    }

    uninhibit() {
        if (!this._isInhibited || this._inhibitorCookie === null)
            return;

        try {
            this._sessionManager.UninhibitRemote(this._inhibitorCookie);
            this._inhibitorCookie = null;
            this._isInhibited = false;
        } catch (e) {
            console.error(`Pomodoro: Failed to remove inhibitor: ${e.message}`);
        }
    }

    destroy() {
        this.uninhibit();
    }
}
