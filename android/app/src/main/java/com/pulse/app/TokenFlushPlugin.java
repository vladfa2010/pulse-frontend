package com.pulse.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Доставляет FCM-токен, полученный до инициализации Capacitor bridge,
 * в JS сразу после старта bridge.
 *
 * PulseMessagingService сохраняет токен в SharedPreferences ("CapacitorStorage", "fcm_token")
 * в onNewToken(), потому что PushNotificationsPlugin ещё может быть null при cold start.
 */
@CapacitorPlugin(name = "TokenFlush")
public class TokenFlushPlugin extends Plugin {

    @Override
    public void load() {
        super.load();

        SharedPreferences prefs = getContext().getSharedPreferences(
                "CapacitorStorage",
                Context.MODE_PRIVATE
        );
        String token = prefs.getString("fcm_token", null);
        if (token == null) {
            return;
        }

        // Bridge готов — отправляем отложенный токен в JS.
        // Событие "registration" отправляется с retain=true, поэтому оно
        // дойдёт даже если JS-листенер подпишется позже.
        PushNotificationsPlugin.onNewToken(token);
    }
}
