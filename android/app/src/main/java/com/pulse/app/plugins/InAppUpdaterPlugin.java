package com.pulse.app.plugins;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "InAppUpdater")
public class InAppUpdaterPlugin extends Plugin {

    private static final String APK_FILE_NAME = "update.apk";
    private long currentDownloadId = -1;
    private PluginCall currentCall;
    private BroadcastReceiver downloadReceiver;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("APK URL is required");
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Unable to get application context");
            return;
        }

        // Android 8+ requires REQUEST_INSTALL_PACKAGES permission to install unknown apps.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                call.reject("INSTALL_PACKAGES_PERMISSION_DENIED");
                return;
            }
        }

        // Clean up any previously downloaded APK.
        File apkFile = new File(context.getExternalCacheDir(), APK_FILE_NAME);
        if (apkFile.exists()) {
            apkFile.delete();
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setMimeType("application/vnd.android.package-archive");
        request.setTitle("PULSE update");
        request.setDescription("Downloading new version...");
        request.setDestinationUri(Uri.fromFile(apkFile));
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
        request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);

        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("DownloadManager is not available");
            return;
        }

        currentCall = call;
        currentDownloadId = dm.enqueue(request);
        registerDownloadReceiver(context);
        call.keepAlive();
    }

    private void registerDownloadReceiver(Context context) {
        if (downloadReceiver != null) {
            return;
        }
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != currentDownloadId) {
                    return;
                }
                handleDownloadComplete(ctx);
            }
        };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }
    }

    private void handleDownloadComplete(Context context) {
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            rejectCurrent("DownloadManager is not available");
            return;
        }

        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(currentDownloadId);
        try (Cursor cursor = dm.query(query)) {
            if (!cursor.moveToFirst()) {
                rejectCurrent("Download not found");
                return;
            }
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            if (statusIndex == -1) {
                rejectCurrent("Unable to read download status");
                return;
            }
            int status = cursor.getInt(statusIndex);
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                int reason = reasonIndex != -1 ? cursor.getInt(reasonIndex) : -1;
                rejectCurrent("Download failed: " + reason);
                return;
            }
        }

        File apkFile = new File(context.getExternalCacheDir(), APK_FILE_NAME);
        if (!apkFile.exists()) {
            rejectCurrent("Downloaded APK not found");
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
        );

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        try {
            context.startActivity(installIntent);
            resolveCurrent(new JSObject().put("started", true));
        } catch (Exception e) {
            rejectCurrent("Failed to start installer: " + e.getMessage());
        }
    }

    private void resolveCurrent(JSObject result) {
        if (currentCall != null) {
            currentCall.resolve(result);
            currentCall = null;
        }
        cleanupReceiver();
    }

    private void rejectCurrent(String message) {
        if (currentCall != null) {
            currentCall.reject(message);
            currentCall = null;
        }
        cleanupReceiver();
    }

    private void cleanupReceiver() {
        currentDownloadId = -1;
        if (downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {
            }
            downloadReceiver = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        cleanupReceiver();
        super.handleOnDestroy();
    }
}
