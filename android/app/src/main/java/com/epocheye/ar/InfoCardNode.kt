package com.epocheye.ar

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import com.epocheye.R
import com.google.ar.core.Anchor
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.node.ViewNode

/**
 * 3D-anchored info card showing heritage identification results.
 *
 * Uses SceneView's ViewNode to render an Android View as a billboard
 * (always faces the camera) in AR space, attached to an ARCore Anchor.
 */
class InfoCardNode(
    private val context: Context,
    anchor: Anchor,
    private val name: String,
    private val period: String,
    private val significance: String,
    private val fact: String,
    private val onTap: (() -> Unit)? = null,
    private val autoDismissMs: Long = 8000L,
) : AnchorNode(anchor = anchor) {

    private val handler = Handler(Looper.getMainLooper())
    private var viewNode: ViewNode? = null

    init {
        buildCard()
    }

    private fun buildCard() {
        val cardView = LayoutInflater.from(context)
            .inflate(R.layout.ar_info_card, null, false)

        cardView.findViewById<TextView>(R.id.ar_card_name).text = name
        cardView.findViewById<TextView>(R.id.ar_card_period).text = period
        cardView.findViewById<TextView>(R.id.ar_card_significance).text = significance
        cardView.findViewById<TextView>(R.id.ar_card_fact).text = fact

        // Tap handler
        cardView.setOnClickListener {
            onTap?.invoke()
        }

        val node = ViewNode().apply {
            setView(cardView)
            // Billboard mode: always face the camera
            isBillboard = true
        }

        viewNode = node
        addChildNode(node)

        // Fade-in animation: start invisible, animate alpha
        cardView.alpha = 0f
        cardView.animate()
            .alpha(1f)
            .setDuration(300)
            .start()

        // Auto-dismiss after timeout
        handler.postDelayed({
            dismiss()
        }, autoDismissMs)
    }

    fun dismiss() {
        val view = viewNode?.view ?: return
        view.animate()
            .alpha(0f)
            .setDuration(200)
            .withEndAction {
                destroy()
            }
            .start()
    }

    override fun destroy() {
        handler.removeCallbacksAndMessages(null)
        super.destroy()
    }
}
