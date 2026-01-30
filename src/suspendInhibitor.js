// Suspend Inhibitor for Pomodoro Timer
// Uses DBus org.gnome.SessionManager to prevent auto-suspend
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';



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

        try {
            const params = [
                GLib.Variant.new_string('pomodoro-timer'),
                GLib.Variant.new_uint32(0),
                GLib.Variant.new_string('Pomodoro Timer is running'),
                GLib.Variant.new_uint32(INHIBIT_IDLE | INHIBIT_SUSPEND),
            ];
            const paramsVariant = GLib.Variant.new_tuple(params);

            const cookieTuple = this._sessionManager.call_sync(
                'Inhibit',
                paramsVariant,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            if (cookieTuple !== null) {
                this._inhibitorCookie = cookieTuple.get_child_value(0).get_uint32();
                this._isInhibited = true;
            }
        } catch (e) {
            console.log(`Pomodoro: Failed to add inhibitor: ${e.message}`);
        }
    }

    uninhibit() {
        if (!this._isInhibited || this._inhibitorCookie === null)
            return;

        try {
            this._sessionManager.UninhibitRemote(this._inhibitorCookie);
            this._inhibitorCookie = null;
            this._isInhibited = false;
        } catch (e) {
            console.log(`Pomodoro: Failed to remove inhibitor: ${e.message}`);
        }
    }

    destroy() {
        this.uninhibit();
    }
}
