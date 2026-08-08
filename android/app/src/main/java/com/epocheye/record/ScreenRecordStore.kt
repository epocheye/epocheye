package com.epocheye.record

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Where a clip lives, and how it gets out of the app.
 *
 * The recorder writes to the app cache first and the file is copied into
 * MediaStore afterwards, rather than encoding straight into a MediaStore file
 * descriptor. That ordering is deliberate:
 *
 *  - an out-of-space failure surfaces during the copy, not as a half-published
 *    gallery item the user has to clean up;
 *  - if the MediaStore insert fails for any reason, we still hold a complete,
 *    shareable file rather than nothing;
 *  - MediaRecorder wants a seekable FD for MP4, and openFileDescriptor
 *    behaviour across OEMs is not uniform.
 *
 * Cost is one background copy of ~30-80 MB, covered by the "Saving…" state.
 */
object ScreenRecordStore {
    private const val TAG = "EpocheyeRecord"
    private const val DIR = "clips"
    private const val PROVIDER_SUFFIX = ".clipprovider"
    private val MAX_AGE_MS = 24L * 60 * 60 * 1000

    fun newCacheFile(context: Context, hint: String?): File {
        val dir = File(context.cacheDir, DIR).apply { mkdirs() }
        pruneOld(dir)
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
        val slug = (hint ?: "clip").replace(Regex("[^A-Za-z0-9_-]"), "-").take(40)
        return File(dir, "epocheye-$slug-$stamp.mp4")
    }

    /** Cache hygiene: a failed share must not leave clips on disk indefinitely. */
    private fun pruneOld(dir: File) {
        try {
            val cutoff = System.currentTimeMillis() - MAX_AGE_MS
            dir.listFiles()?.forEach { f ->
                if (f.isFile && f.lastModified() < cutoff) f.delete()
            }
        } catch (_: Throwable) {
        }
    }

    /**
     * Publish into the user's gallery under Movies/Epocheye. Returns the
     * content:// uri, or null if it could not be saved — in which case the
     * caller falls back to the FileProvider uri and the clip is still shareable.
     */
    fun saveToGallery(context: Context, file: File, displayName: String): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        val resolver = context.contentResolver
        val collection =
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(
                MediaStore.Video.Media.RELATIVE_PATH,
                Environment.DIRECTORY_MOVIES + "/Epocheye",
            )
            put(MediaStore.Video.Media.DATE_TAKEN, System.currentTimeMillis())
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        var uri: Uri? = null
        return try {
            uri = resolver.insert(collection, values) ?: return null
            resolver.openOutputStream(uri)?.use { out ->
                file.inputStream().use { input -> input.copyTo(out) }
            } ?: return null
            val done = ContentValues().apply {
                put(MediaStore.Video.Media.IS_PENDING, 0)
            }
            resolver.update(uri, done, null, null)
            uri.toString()
        } catch (t: Throwable) {
            Log.w(TAG, "gallery save failed", t)
            try {
                uri?.let { resolver.delete(it, null, null) }
            } catch (_: Throwable) {
            }
            null
        }
    }

    fun contentUriFor(context: Context, file: File): Uri =
        FileProvider.getUriForFile(
            context,
            context.packageName + PROVIDER_SUFFIX,
            file,
        )

    fun buildShareIntent(uri: Uri, text: String?): Intent {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, uri)
            if (!text.isNullOrBlank()) putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return Intent.createChooser(send, null).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
}
