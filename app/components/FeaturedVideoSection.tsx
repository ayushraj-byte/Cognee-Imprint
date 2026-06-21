"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export default function FeaturedVideoSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="pt-6 md:pt-10 pb-20 md:pb-32 overflow-hidden">
      <div ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.9 }}
          className="overflow-hidden aspect-video relative"
        >
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4"
            className="w-full h-full object-cover"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 px-8 md:px-16 py-8 md:py-12 flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="liquid-glass rounded-2xl p-6 md:p-8 max-w-md">
              <p className="text-white/50 text-xs tracking-widest uppercase mb-3">
                REAL-TIME EDGE SYNCHRONIZATION
              </p>
              <p className="text-white text-sm md:text-base leading-relaxed">
                As you work with your AI assistant, Imprint&apos;s background
                engine streams message vectors directly into an isolated AWS serverless
                database, creating a permanent recall layer.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium flex-shrink-0 cursor-pointer"
            >
              Deploy Stack
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
