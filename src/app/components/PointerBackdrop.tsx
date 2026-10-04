import { useEffect, useRef } from 'react';

/** A decorative field: only redraw while the pointer response is settling. */
export function PointerBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || typeof window.matchMedia !== 'function') return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const preference = window.matchMedia('(prefers-reduced-motion: no-preference) and (pointer: fine)');
    let width = 0, height = 0, frame = 0;
    let x = 0, y = 0, targetX = 0, targetY = 0, intensity = 0, targetIntensity = 0;
    const symbols = ['·', '○', '+', '○', '×', '·', '○', '#'];

    function draw() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (intensity > 0.01) {
        const glow = context.createRadialGradient(x, y, 0, x, y, 190);
        glow.addColorStop(0, `rgba(183,100,68,${intensity * 0.12})`);
        glow.addColorStop(1, 'rgba(183,100,68,0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }
      context.font = '12px ui-monospace, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (let row = 0; row * 30 < height; row++) {
        for (let col = 0; col * 30 < width; col++) {
          const px = col * 30 + 15, py = row * 30 + 15;
          const dx = px - x, dy = py - y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.max(0, 1 - distance / 170) ** 2 * intensity;
          const shift = influence * 18 / Math.max(distance, 1);
          context.fillStyle = `rgba(168,119,93,${0.09 + influence * 0.38})`;
          context.fillText(symbols[(row * 7 + col * 3) % symbols.length], px + dx * shift, py + dy * shift);
        }
      }
    }

    function animate() {
      x += (targetX - x) * 0.18;
      y += (targetY - y) * 0.18;
      intensity += (targetIntensity - intensity) * 0.13;
      draw();
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.2 || Math.abs(targetIntensity - intensity) > 0.002
        ? requestAnimationFrame(animate) : 0;
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(animate); }
    function move(event: PointerEvent) {
      if (!preference.matches || event.pointerType !== 'mouse') return;
      const bounds = canvas!.getBoundingClientRect();
      targetX = event.clientX - bounds.left;
      targetY = event.clientY - bounds.top;
      if (intensity < 0.01) { x = targetX; y = targetY; }
      targetIntensity = 1;
      schedule();
    }
    function leave() { targetIntensity = 0; schedule(); }
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      intensity = targetIntensity = 0;
      draw();
    }
    function resize() {
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      reset();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', reset, { passive: true });
    preference.addEventListener('change', reset);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', reset);
      window.removeEventListener('scroll', reset);
      preference.removeEventListener('change', reset);
    };
  }, []);
  return <canvas ref={ref} className="museum-pointer-backdrop" aria-hidden="true" />;
}
