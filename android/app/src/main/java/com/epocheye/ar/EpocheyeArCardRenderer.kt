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

    /**
     * Card bitmap width in pixels.
     *
     * 512, down from 1024. A card is a 1.75 m quad read from several metres away —
     * 1024 px was well past what the display can resolve at that size, and the
     * cost is quadratic: each card is an ARGB_8888 bitmap PLUS a Filament texture,
     * so a 20-card discovery layer was carrying roughly 54 MB of texture. At 512
     * that is about 13 MB. Twenty alpha-blended quads also defeat early-Z, so the
     * saving is bandwidth as well as memory — both of which are heat.
     *
     * Every hardcoded dimension below is multiplied by [S], so the layout stays
     * proportionally identical at any W.
     */
    private const val W = 512

    /**
     * Every hardcoded dimension below was authored against a 1024-px card, so they
     * are scaled by this rather than retyped — the layout stays proportionally
     * identical and there is one number to change if the trade-off is revisited.
     */
    private const val S = W / 1024f

    private const val PAD = 56f * S
    private val GREEN = Color.parseColor("#4CAF50")
    private val INK = Color.parseColor("#F5F0E8")
    private val MUTED = Color.parseColor("#BDB6AC")

    /**
     * cardJson is a card object: { display_name, period, dynasty, material,
     * origin, identity_confidence, narrative, iconography }.
     *
     * Pass "continuation": true for follow-on section cards. A continuation card
     * renders body-only UNLESS it carries a "heading" (e.g. "What to look for" or a
     * timeline-layer label), in which case the heading is drawn as its title so each
     * section card is self-labelled and reads as complete.
     */
    /**
     * Renders a HERITAGE DISCOVERY card — a different surface from the recognition
     * card above, and it deliberately DOES draw its evidence line.
     *
     * The no-source rule on [render] exists because a recognition card's confidence
     * is a statement about *our model* ("we think this is a Buddha, 0.71"), and
     * showing that to a visitor is noise at best. A discovery card's line is the
     * opposite: it is the provenance of the fact itself — "CONFIRMED · C. Mackenzie
     * 1791, key 4" — and on an evidence-led reconstruction it is the most important
     * thing on the card. A card that says a dimension is UNRECORDED is only
     * meaningful if it says so.
     *
     * cardJson: { title, meta, body, accent? } where accent is "green" (the fact is
     * confirmed) or anything else (muted).
     */
    fun renderDiscovery(cardJson: String): Bitmap? {
        val o = try {
            JSONObject(cardJson)
        } catch (_: Throwable) {
            return null
        }
        val title = o.optString("title").trim()
        val meta = o.optString("meta").trim()
        val body = o.optString("body").trim()
        if (title.isEmpty() && body.isEmpty()) return null
        val accent = if (o.optString("accent", "muted") == "green") GREEN else MUTED

        val inner = (W - PAD * 2).toInt()
        val tp = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = INK; textSize = 68f * S; typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        }
        val mp = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accent; textSize = 30f * S; typeface = Typeface.SANS_SERIF
        }
        val bp = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#E2DCD2"); textSize = 38f * S; typeface = Typeface.SANS_SERIF
        }
        val tl = if (title.isEmpty()) null else StaticLayout.Builder
            .obtain(title, 0, title.length, tp, inner).build()
        val ml = if (meta.isEmpty()) null else StaticLayout.Builder
            .obtain(meta, 0, meta.length, mp, inner).build()
        val bl = if (body.isEmpty()) null else StaticLayout.Builder
            .obtain(body, 0, body.length, bp, inner).build()

        val h = (PAD + (tl?.height ?: 0) + (if (ml != null) 18f * S + ml.height else 0f) +
            (if (bl != null) 28f * S + bl.height else 0f) + PAD).toInt().coerceIn((220 * S).toInt(), (2200 * S).toInt())
        val bmp = Bitmap.createBitmap(W, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(240, 10, 8, 12) }
        val rect = RectF(8f * S, 8f * S, W - 8f * S, h - 8f * S)
        c.drawRoundRect(rect, 40f * S, 40f * S, bg)
        c.drawRoundRect(
            rect, 40f * S, 40f * S,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 6f * S
                color = Color.argb(150, Color.red(accent), Color.green(accent), Color.blue(accent))
            },
        )
        // Accent spine down the left edge — the tier at a glance, before reading.
        c.drawRoundRect(
            RectF(8f * S, 8f * S, 20f * S, h - 8f * S), 6f * S, 6f * S,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent },
        )
        var y = PAD
        c.save(); c.translate(PAD, y)
        tl?.draw(c); c.restore()
        y += (tl?.height ?: 0).toFloat()
        if (ml != null) {
            y += 18f * S
            c.save(); c.translate(PAD, y); ml.draw(c); c.restore()
            y += ml.height
        }
        if (bl != null) {
            y += 28f * S
            c.save(); c.translate(PAD, y); bl.draw(c); c.restore()
        }
        return bmp
    }

    fun render(cardJson: String): Bitmap? {
        val o = try {
            JSONObject(cardJson)
        } catch (_: Throwable) {
            return null
        }

        val continuation = o.optBoolean("continuation", false)
        val heading = o.optString("heading")
        // Source/confidence (grounded vs inferred) is backend-only — never shown to
        // the user. The card renders uniformly with no badge and no "Likely:" prefix.
        val accent = if (continuation) MUTED else GREEN
        // First card → object name; a headed section card → its heading; a plain
        // continuation card → no title (body only).
        val title = when {
            !continuation -> o.optString("display_name").ifBlank { "Unknown object" }
            heading.isNotBlank() -> heading
            else -> ""
        }
        val meta = if (!continuation) {
            listOf(
                o.optString("period"), o.optString("dynasty"),
                o.optString("material"), o.optString("origin"),
            ).filter { it.isNotBlank() }.joinToString("   ·   ")
        } else {
            ""
        }
        val narrative = o.optString("narrative")

        val contentW = (W - PAD * 2).toInt()

        val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = INK; textSize = 64f * S; typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
        }
        val metaPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = MUTED; textSize = 30f * S; typeface = Typeface.SANS_SERIF
        }
        val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = INK; textSize = 38f * S; typeface = Typeface.SANS_SERIF
        }

        val titleLayout = if (title.isNotBlank()) staticLayout(title, titlePaint, contentW) else null
        val metaLayout =
            if (meta.isNotBlank()) staticLayout(meta, metaPaint, contentW) else null
        // Each card now holds ONE complete section, so allow the full section to show
        // (JS caps section length); only guard against a pathological blob.
        val bodyLayout = if (narrative.isNotBlank()) {
            staticLayout(ellipsize(narrative, 800), bodyPaint, contentW)
        } else {
            null
        }

        var y = PAD
        if (titleLayout != null) {
            y += titleLayout.height
        }
        if (metaLayout != null) y += 18f * S + metaLayout.height
        if (bodyLayout != null) y += (if (titleLayout != null) 28f * S else 0f) + bodyLayout.height
        y += PAD
        val height = y.toInt().coerceIn((240 * S).toInt(), (2200 * S).toInt())

        val bmp = Bitmap.createBitmap(W, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        // Card background + accent border.
        val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#F00C0A08") }
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = 4f * S
            color = (accent and 0x00FFFFFF) or 0x73000000.toInt() // ~45% alpha accent
        }
        val rect = RectF(8f * S, 8f * S, W - 8f * S, height - 8f * S)
        canvas.drawRoundRect(rect, 40f * S, 40f * S, bg)
        canvas.drawRoundRect(rect, 40f * S, 40f * S, border)

        var cy = PAD
        if (titleLayout != null) {
            canvas.save()
            canvas.translate(PAD, cy)
            titleLayout.draw(canvas)
            canvas.restore()
            cy += titleLayout.height
        }

        if (metaLayout != null) {
            cy += 18f * S
            canvas.save(); canvas.translate(PAD, cy); metaLayout.draw(canvas); canvas.restore()
            cy += metaLayout.height
        }
        if (bodyLayout != null) {
            if (titleLayout != null) cy += 28f * S
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
