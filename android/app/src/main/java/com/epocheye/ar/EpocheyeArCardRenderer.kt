package com.epocheye.ar

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.StaticLayout
import android.text.TextPaint
import org.json.JSONObject

/**
 * Renders a grounded object data card to a Bitmap, so it can be shown as a
 * world-anchored panel in the AR scene (see EpocheyeDetectARView.attachCard).
 *
 * Uses only stable Android 2D graphics (Canvas / Paint / StaticLayout) — no
 * SceneView types — so this part is build-safe regardless of the SceneView
 * version. Source/confidence (grounded vs inferred) is backend-only and is never
 * drawn on the card — every card renders uniformly.
 */
object EpocheyeArCardRenderer {

    private const val W = 1024
    private const val PAD = 56f
    private val GREEN = Color.parseColor("#4CAF50")
    private val INK = Color.parseColor("#F5F0E8")
    private val MUTED = Color.parseColor("#BDB6AC")

    /**
     * cardJson is a card object: { display_name, period, dynasty, material,
     * origin, identity_confidence, narrative, iconography }.
     *
     * Pass "continuation": true for follow-on pages of long content — those render
     * body-only (no badge / title / meta), so a long narration can be split across
     * 2–3 spread placards.
     */
    fun render(cardJson: String): Bitmap? {
        val o = try {
            JSONObject(cardJson)
        } catch (_: Throwable) {
            return null
        }

        val continuation = o.optBoolean("continuation", false)
        // Source/confidence (grounded vs inferred) is backend-only — never shown to
        // the user. The card renders uniformly with no badge and no "Likely:" prefix.
        val accent = if (continuation) MUTED else GREEN
        val title = o.optString("display_name").ifBlank { "Unknown object" }
        val meta = listOf(
            o.optString("period"), o.optString("dynasty"),
            o.optString("material"), o.optString("origin"),
        ).filter { it.isNotBlank() }.joinToString("   ·   ")
        val narrative = o.optString("narrative")

        val contentW = (W - PAD * 2).toInt()

        val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = INK; textSize = 64f; typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
        }
        val metaPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = MUTED; textSize = 30f; typeface = Typeface.SANS_SERIF
        }
        val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = INK; textSize = 34f; typeface = Typeface.SANS_SERIF
        }

        val titleLayout = if (!continuation) staticLayout(title, titlePaint, contentW) else null
        val metaLayout =
            if (!continuation && meta.isNotBlank()) staticLayout(meta, metaPaint, contentW) else null
        // Cap the narrative so the panel stays a readable size in 3D.
        val bodyLayout = if (narrative.isNotBlank()) {
            staticLayout(ellipsize(narrative, 360), bodyPaint, contentW)
        } else {
            null
        }

        var y = PAD
        if (titleLayout != null) {
            y += titleLayout.height
        }
        if (metaLayout != null) y += 18f + metaLayout.height
        if (bodyLayout != null) y += (if (titleLayout != null) 28f else 0f) + bodyLayout.height
        y += PAD
        val height = y.toInt().coerceIn(240, 1600)

        val bmp = Bitmap.createBitmap(W, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        // Card background + accent border.
        val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#F00C0A08") }
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = 4f
            color = (accent and 0x00FFFFFF) or 0x73000000.toInt() // ~45% alpha accent
        }
        val rect = RectF(8f, 8f, (W - 8).toFloat(), (height - 8).toFloat())
        canvas.drawRoundRect(rect, 40f, 40f, bg)
        canvas.drawRoundRect(rect, 40f, 40f, border)

        var cy = PAD
        if (titleLayout != null) {
            canvas.save()
            canvas.translate(PAD, cy)
            titleLayout.draw(canvas)
            canvas.restore()
            cy += titleLayout.height
        }

        if (metaLayout != null) {
            cy += 18f
            canvas.save(); canvas.translate(PAD, cy); metaLayout.draw(canvas); canvas.restore()
            cy += metaLayout.height
        }
        if (bodyLayout != null) {
            if (titleLayout != null) cy += 28f
            canvas.save(); canvas.translate(PAD, cy); bodyLayout.draw(canvas); canvas.restore()
        }
        return bmp
    }

    private fun ellipsize(s: String, max: Int): String =
        if (s.length <= max) s else s.substring(0, max).trimEnd() + "…"

    @Suppress("DEPRECATION")
    private fun staticLayout(text: String, paint: TextPaint, width: Int): StaticLayout {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
                .setLineSpacing(6f, 1f)
                .build()
        } else {
            StaticLayout(text, paint, width, android.text.Layout.Alignment.ALIGN_NORMAL, 1f, 6f, false)
        }
    }
}
