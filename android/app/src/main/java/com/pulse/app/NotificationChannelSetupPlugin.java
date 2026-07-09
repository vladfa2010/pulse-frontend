package com.pulse.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Создаёт notification channel при старте Capacitor bridge.
 *
 * На Android 13+ (API 26+) приложение появляется в Settings → Notifications
 * только после создания хотя бы одного канала. Без этого плагина каналы
 * создавались лениво при получении push, и app был невидим в настройках
 * до первого уведомления.
 */
@CapacitorPlugin(name = "NotificationChannelSetup")
public class NotificationChannelSetupPlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        createDefaultChannel();
    }

    private void createDefaultChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager nm = (NotificationManager) getContext()
                .getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel("pulse_default") != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                "pulse_default",
                "Новости",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Уведомления о новых статьях");
        channel.enableVibration(true);

        nm.createNotificationChannel(channel);
    }
}
