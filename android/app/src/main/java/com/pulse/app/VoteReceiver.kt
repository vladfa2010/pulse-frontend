package com.pulse.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class VoteReceiver : BroadcastReceiver() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onReceive(context: Context, intent: Intent) {
        val voteValue = intent.getStringExtra("vote_value") ?: return

        // Убираем уведомление
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
            .cancel(1001)

        // Читаем JWT из Capacitor Preferences
        val prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
        val token = prefs.getString("pulse_token", null)

        if (token.isNullOrBlank()) {
            Toast.makeText(context, "Войдите в приложение, чтобы голосовать", Toast.LENGTH_LONG).show()
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
                it.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(it)
            }
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val apiUrl = getApiUrl(context)
                val json = JSONObject().put("value", voteValue.toInt()).toString()

                val request = Request.Builder()
                    .url("$apiUrl/api/sentiment/vote")
                    .post(json.toRequestBody("application/json".toMediaType()))
                    .header("Authorization", "Bearer $token")
                    .header("Content-Type", "application/json")
                    .build()

                client.newCall(request).execute().use { response ->
                    withContext(Dispatchers.Main) {
                        when (response.code) {
                            201 -> {
                                val body = response.body?.string()
                                val jsonResp = body?.let { JSONObject(it) }
                                val sync = jsonResp?.optBoolean("sync", false) ?: false
                                Toast.makeText(
                                    context,
                                    if (sync) "Вы в синхроне с рынком" else "Голос учтён",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                            429 -> {
                                val seconds = response.body?.string()
                                    ?.let { JSONObject(it).optInt("secondsUntilNext", 0) } ?: 0
                                val mins = seconds / 60
                                Toast.makeText(
                                    context,
                                    "Подождите ${mins} мин до следующего голоса",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                            401 -> {
                                Toast.makeText(context, "Сессия истекла. Войдите заново.", Toast.LENGTH_LONG).show()
                                prefs.edit().remove("pulse_token").apply()
                            }
                            else -> Toast.makeText(context, "Не удалось отправить голос", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            } catch (_: IOException) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Нет связи", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Ошибка: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun getApiUrl(context: Context): String {
        val prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
        return prefs.getString("api_url", "https://pulse-api-bsov.onrender.com")
            ?: "https://pulse-api-bsov.onrender.com"
    }
}
