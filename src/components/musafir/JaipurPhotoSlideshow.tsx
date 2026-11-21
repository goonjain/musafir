import React, { useEffect, useState, useRef } from 'react';


// Paths to the four local images – must exist in public/images
const images = [
  { src: "/images/slideshow/amber.jpg", caption: "Amber Fort" },
  { src: "/images/slideshow/hawa-mahal.jpg", caption: "Hawa Mahal" },
  { src: "/images/slideshow/jal-mahal.jpg", caption: "Jal Mahal" },
  { src: "/images/slideshow/panna-meena.jpg", caption: "Panna Meena ka Kund" },
];

/**
 * Simple cross‑fade slideshow component.
 * - Auto‑advances every 4 seconds.
 * - Uses a 600‑800 ms CSS opacity transition.
 * - Pauses when the page is hidden or when the user prefers reduced motion.
 * - Cleans up timers on unmount.
 */
export default function JaipurPhotoSlideshow() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<number | null>(null);
  const reducedMotion = useRef<boolean>(false);

  // Determine prefers‑reduced‑motion once on mount
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handleChange = () => (reducedMotion.current = mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Advance slide every 4 seconds unless paused
  useEffect(() => {
    if (reducedMotion.current) return; // don't auto‑advance
    const tick = () => {
      setActive((i) => (i + 1) % images.length);
    };
    timerRef.current = window.setInterval(tick, 4000);
    const handleVisibility = () => {
      if (document.hidden) {
        // pause
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else if (!reducedMotion.current && timerRef.current === null) {
        timerRef.current = window.setInterval(tick, 4000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[3/4] max-h-[560px] min-h-[480px] rounded-lg overflow-hidden bg-muted">
      {/* Images stacked on top of each other */}
      {images.map((img, idx) => (
        <img
          key={img.src}
          src={img.src}
          alt={img.caption}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${idx === active ? 'opacity-100' : 'opacity-0'} ${reducedMotion.current ? 'duration-0' : ''}`}
          onError={(e) => {
            // hide broken image
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
      {/* Caption */}
      <div className="absolute bottom-0 left-0 w-full bg-black/30 text-white text-sm py-1 px-2 text-center">
        {images[active].caption}
      </div>
      {/* Progress dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5">
        {images.map((_, i) => (
          <span
            key={i}
            className={`block w-2 h-2 rounded-full ${i === active ? 'bg-white' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}

