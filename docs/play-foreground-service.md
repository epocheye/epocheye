# Play Console: foreground service declaration

Everything Google Play asks for about this app's foreground services, in the
words the form wants, plus the reasoning behind each answer. Fill this in under
**Policy → App content → Foreground service permissions** before the next
release that ships `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.

The declaration is required from the release that first contains the
permission. Shipping the permission without it gets the release rejected, and
the rejection names the permission rather than the reason, so keep this file
next to the manifest change that introduced it.

---

## What the app actually declares

Two foreground services reach the merged manifest. Only one of them is ours and
only one of them needs a declaration.

| Service | Type | Origin | Declaration needed |
|---|---|---|---|
| `com.brentvatne.exoplayer.VideoPlaybackService` | `mediaPlayback` | react-native-video 6.19.1, declared by us in `android/app/src/main/AndroidManifest.xml` | **Yes** |
| `app.notifee.core.ForegroundService` | `shortService` | `@notifee/react-native`, merged in from the library | No — `shortService` is outside the declaration requirement |

Permissions added for this:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```

`FOREGROUND_SERVICE` is not a leftover. From API 34 the typed permission is
**additional to** the generic one, not a replacement, and the service will not
start without both.

---

## The form

**Which foreground service types does your app use?**
Media playback.

**What is the core functionality that requires this?**

> Epocheye is a heritage guide. At each site it plays a recorded audio guide —
> one narrated clip per stop, up to about two minutes each — that a visitor
> listens to while walking around the building. Playback continues while the
> screen is off, because a visitor walking between two rooms puts the phone
> down or in a pocket. The foreground service exists so the notification and
> lock-screen transport can pause, resume and seek that narration without the
> visitor unlocking the phone and reopening the app.

**Why can this not be done with a background task or WorkManager?**

> It is user-initiated, continuous audio playback with a visible transport, not
> deferrable work. `WorkManager` cannot own an ExoPlayer session or publish a
> `MediaSession` notification, and Android requires a `mediaPlayback` foreground
> service for any audio that continues while the app is not in the foreground.

**When does the service start and stop?**

> It starts only when the visitor presses play on an audio-guide stop or opens a
> reconstruction that carries narration, and it stops when that clip ends, when
> the visitor pauses and leaves, or when the app's task is removed. It never
> starts at boot, on a schedule, or in response to a push. Nothing else in the
> app runs a foreground service of this type.

**Video / screen recording:** the app records screen video for a shareable AR
clip via `MediaProjection`, but that path is user-initiated per recording, is
not backed by this service, and does not use a `mediaPlayback` type. Mention it
only if the form asks about media projection separately.

---

## Video for the declaration

Play asks for a short screen recording showing the feature in use. Record on a
real device:

1. Open a site → **Listen — audio guide**. The first stop starts playing.
2. Lock the phone. The lock screen shows the stop title, the site name beneath
   it, and a play/pause control.
3. Pause from the lock screen. Resume from the lock screen.
4. Unlock and show the app still on the same stop, at the position it was
   paused at.

That sequence is exactly the justification above, in order, which is what makes
it pass on the first read.

---

## Where the code is

- Permissions and the `<service>` declaration:
  `android/app/src/main/AndroidManifest.xml` — both carry comments explaining
  why the type is `mediaPlayback` and why the library's service is declared by
  the app rather than by the library (react-native-video ships an empty
  manifest and leaves the decision to the app, which is right: the app is what
  answers for a foreground service in review).
- The opt-in: `AudioPlayer`'s `showNotificationControls` prop, **off by
  default**. Only two callers turn it on — `AudioGuideScreen` and
  `MagicWindowScreen`, the two long-form narration surfaces. Museum-mode
  narration, the journey step and a figure speaking a single line all leave it
  off, so a two-second clip never puts a media notification on the lock screen.
  Keep it that way; a service that starts for every short line is the kind of
  thing that reads as abuse.

---

## One thing that is NOT what this fixes

Background audio already worked without any of this. A 105 s clip was measured
playing to completion with the screen locked, on a device with no foreground
service of any kind, because `<Video playInBackground/>` keeps ExoPlayer alive
on its own. What was missing was only the *control*. If a reviewer asks whether
the service is needed for playback to continue, the honest answer is that it is
needed for the transport and for playback to be reliable under Doze once the
screen has been off for longer, not to make audio work at all.
