package com.pulse.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class PulseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data

        when (data["type"]) {
            "sentiment_vote" -> showSentimentVoteNotification(data)
            else -> handleRegularPush(remoteMessage)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PushNotificationsPlugin.onNewToken(token)
    }

    // ═══════════════════════════════════════════════════════════════
    // Новый push: 3 кнопки голосования в Sentiment Index
    // ═══════════════════════════════════════════════════════════════
    private fun showSentimentVoteNotification(data: Map<String, String>) {
        val title = data["title"] ?: "PULSE"
        val body = data["body"] ?: ""

        createSentimentChannel()

        val builder = NotificationCompat.Builder(this, SENTIMENT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .addAction(R.drawable.ic_notification, "Позитивно", votePendingIntent("1", 101))
            .addAction(R.drawable.ic_notification, "Нейтрально", votePendingIntent("0", 102))
            .addAction(R.drawable.ic_notification, "Негативно", votePendingIntent("-1", 103))

        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(SENTIMENT_NOTIFICATION_ID, builder.build())
    }

    private fun votePendingIntent(value: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, VoteReceiver::class.java).apply {
            putExtra("vote_value", value)
        }
        return PendingIntent.getBroadcast(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createSentimentChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(SENTIMENT_CHANNEL_ID) != null) return

        nm.createNotificationChannel(
            NotificationChannel(SENTIMENT_CHANNEL_ID, "Голосование", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "Напоминания проголосовать в индексе настроения" }
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // Обычные пуши (новости)
    // ═══════════════════════════════════════════════════════════════
    private fun handleRegularPush(remoteMessage: RemoteMessage) {
        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "PULSE"
        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: "Новая новость"
        val channelId = remoteMessage.data["channelId"] ?: "pulse_default"

        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            remoteMessage.data.forEach { (key, value) -> putExtra(key, value) }
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        createChannelIfNeeded(channelId)

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        val notificationId = remoteMessage.messageId?.hashCode()
            ?: remoteMessage.data["news_id"]?.hashCode()
            ?: System.currentTimeMillis().toInt()

        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(notificationId, builder.build())

        // Dispatch в JS для совместимости с Capacitor foreground listeners
        PushNotificationsPlugin.sendRemoteMessage(remoteMessage)
    }

    private fun createChannelIfNeeded(channelId: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(channelId) != null) return

        nm.createNotificationChannel(
            NotificationChannel(
                channelId,
                if (channelId == "pulse_default") "Новости" else "PULSE",
                NotificationManager.IMPORTANCE_HIGH
            )
        )
    }

    companion object {
        private const val SENTIMENT_CHANNEL_ID = "pulse_sentiment_vote"
        private const val SENTIMENT_NOTIFICATION_ID = 1001
    }
}
