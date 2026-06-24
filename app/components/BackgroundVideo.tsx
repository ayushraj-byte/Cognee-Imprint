"use client";

import { useRef, useEffect, useState } from "react";

interface BackgroundVideoProps {
  /** 0–1 opacity of the dark overlay on top of the video */
  overlayOpacity?: number;
}

// Lightweight, always-instant base layer shown beneath the video. The video asset
// is ~13.5 MB, so on slower connections it takes seconds to buffer — without this
// the background was just flat black until then. This animated gradient paints on
// the first frame (pure CSS, GPU-composited, zero network) so the background looks
// intentional immediately and the heavy video simply fades in on top once ready.
function GradientBase() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(120% 90% at 20% 10%, rgba(34,211,238,0.16), transparent 55%)," +
          "radial-gradient(110% 90% at 85% 30%, rgba(192,132,252,0.14), transparent 55%)," +
          "radial-gradient(130% 100% at 50% 100%, rgba(99,102,241,0.12), transparent 60%)," +
          "#050505",
        backgroundSize: "180% 180%, 180% 180%, 180% 180%, auto",
        animation: "bgAuroraDrift 24s ease-in-out infinite alternate",
        willChange: "background-position",
      }}
    />
  );
}

export default function BackgroundVideo({ overlayOpacity = 0.55 }: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Gate the 13.5 MB download: only mount the <video> once we've decided the user
  // should get it AND the page has gone idle, so it never competes with the
  // critical first paint / JS bundle.
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    // Respect users who shouldn't pay for a heavy autoplay video: Save-Data,
    // slow connections (2g/3g), and reduced-motion. They keep the gradient only.
    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const saveData = conn?.saveData === true;
    const slow = conn ? /(^|-)2g$|3g/.test(conn.effectiveType || "") : false;
    const reduceMotion =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (saveData || slow || reduceMotion) return;

    const ric: (cb: () => void) => number =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb) => window.setTimeout(cb, 300));
    const id = ric(() => setShowVideo(true));
    return () => {
      const cancel = (window as unknown as {
        cancelIdleCallback?: (h: number) => void;
      }).cancelIdleCallback;
      if (cancel) cancel(id);
      else clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!showVideo) return;
    const video = videoRef.current;
    if (!video) return;
    video.style.opacity = "0";

    let animId: number | null = null;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;

    function animateFade(target: number, duration: number) {
      if (!video) return;
      if (animId) cancelAnimationFrame(animId);
      const start = parseFloat(video.style.opacity || "0");
      const t0 = performance.now();
      function step(now: number) {
        const p = Math.min((now - t0) / duration, 1);
        video!.style.opacity = String(start + (target - start) * p);
        if (p < 1) animId = requestAnimationFrame(step);
      }
      animId = requestAnimationFrame(step);
    }

    function startVideo() {
      // Just ask it to play. The fade-in is driven by the "playing" event below,
      // NOT by this promise — a programmatic play() can be rejected by autoplay
      // policy even when muted, which previously left the video stuck paused at
      // opacity 0. Letting the actual "playing" event drive the fade is robust.
      video!.play().catch(() => {});
    }

    const onPlaying = () => animateFade(1, 500);

    const onTimeUpdate = () => {
      const rem = video.duration - video.currentTime;
      if (rem <= 0.55 && parseFloat(video.style.opacity || "1") > 0.01) {
        animateFade(0, 500);
      }
    };

    const onEnded = () => {
      if (animId) cancelAnimationFrame(animId);
      video.style.opacity = "0";
      loopTimer = setTimeout(() => {
        video.currentTime = 0;
        startVideo();
      }, 100);
    };

    // The `autoPlay` attribute starts playback as soon as the element mounts;
    // this is just a belt-and-suspenders nudge. No video.load() — that resets
    // the element and can abort an in-flight autoplay.
    startVideo();

    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (animId) cancelAnimationFrame(animId);
      if (loopTimer) clearTimeout(loopTimer);
    };
  }, [showVideo]);

  return (
    <>
      <style>{`@keyframes bgAuroraDrift{0%{background-position:0% 0%,100% 0%,50% 100%,0 0}100%{background-position:100% 100%,0% 100%,50% 0%,0 0}}`}</style>
      <GradientBase />
      {showVideo && (
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
          className="absolute inset-0 w-full h-full object-cover object-bottom"
          muted
          autoPlay
          playsInline
          preload="auto"
          style={{ opacity: 0, transition: "opacity 1.2s ease" }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
      />
    </>
  );
}
