"use client";

import { useRef, useEffect } from "react";

interface BackgroundVideoProps {
  /** 0–1 opacity of the dark overlay on top of the video */
  overlayOpacity?: number;
}

export default function BackgroundVideo({ overlayOpacity = 0.55 }: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
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
      video!.play()
        .then(() => animateFade(1, 500))
        .catch(() => {});
    }

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

    // Call play() immediately — resolves at once if autoPlay already started it,
    // or waits for buffering. Either way, fade-in fires reliably.
    startVideo();

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (animId) cancelAnimationFrame(animId);
      if (loopTimer) clearTimeout(loopTimer);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
        className="absolute inset-0 w-full h-full object-cover object-bottom"
        muted
        autoPlay
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />
      <div
        className="absolute inset-0"
        style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
      />
    </>
  );
}
