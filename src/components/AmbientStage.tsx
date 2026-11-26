import { useEffect, useRef } from 'react';

type NodePoint = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  radius: number;
  hue: 'lime' | 'cyan';
};

export default function AmbientStage({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let rafId = 0;

    const nodes: NodePoint[] = Array.from({ length: 28 }, (_, idx) => ({
      x: (Math.random() - 0.5) * 1400,
      y: (Math.random() - 0.5) * 900,
      z: Math.random() * 520 + 120,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.2,
      radius: (idx % 3) + 1.4,
      hue: idx % 4 === 0 ? 'cyan' : 'lime',
    }));

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMove(e: PointerEvent) {
      targetX = (e.clientX / Math.max(1, width) - 0.5) * 36;
      targetY = (e.clientY / Math.max(1, height) - 0.5) * 24;
    }

    function drawFrame(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      pointerX += (targetX - pointerX) * 0.05;
      pointerY += (targetY - pointerY) * 0.05;

      // Subtle 3D perspective floor horizon grid
      const horizonY = height * 0.62 + pointerY * 0.35;
      const vanishX = width * 0.52 + pointerX * 0.9;
      ctx.save();
      ctx.strokeStyle = 'rgba(211, 255, 85, 0.045)';
      ctx.lineWidth = 1;

      const rays = 14;
      for (let i = -rays; i <= rays; i++) {
        ctx.beginPath();
        ctx.moveTo(vanishX + i * 24, horizonY);
        ctx.lineTo(vanishX + i * 190, height + 60);
        ctx.stroke();
      }

      for (let row = 1; row <= 8; row++) {
        const t = Math.pow(row / 8, 1.85);
        const y = horizonY + t * (height - horizonY + 40);
        ctx.strokeStyle = `rgba(211, 255, 85, ${0.015 + t * 0.04})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      // Projected 3D luminous orbital particles + light links
      const focal = 460;
      const projected: Array<{ sx: number; sy: number; scale: number; hue: 'lime' | 'cyan'; radius: number }> = [];

      for (const node of nodes) {
        if (!reduceMotion) {
          node.x += node.vx;
          node.y += node.vy;
          node.z -= 0.25;
          if (node.z < 90) node.z = 640;
          if (node.x > 750) node.x = -750;
          if (node.x < -750) node.x = 750;
          if (node.y > 480) node.y = -480;
          if (node.y < -480) node.y = 480;
        }
        const scale = focal / (focal + node.z);
        const sx = width * 0.5 + (node.x - pointerX * 3.5) * scale;
        const sy = height * 0.44 + (node.y - pointerY * 3.5) * scale;
        projected.push({ sx, sy, scale, hue: node.hue, radius: node.radius });
      }

      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const dist = Math.hypot(dx, dy);
          if (dist < 145) {
            const alpha = (1 - dist / 145) * 0.09;
            ctx.strokeStyle = `rgba(211, 255, 85, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      const pulse = Math.sin(time * 0.0014) * 0.15 + 0.85;
      for (const p of projected) {
        const r = Math.max(1, p.radius * p.scale * 1.45);
        const glow = p.hue === 'cyan' ? '120, 214, 221' : '211, 255, 85';
        ctx.fillStyle = `rgba(${glow}, ${(0.24 + p.scale * 0.35) * pulse})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion && !document.hidden) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    if (reduceMotion) {
      drawFrame(0);
    } else {
      rafId = window.requestAnimationFrame(drawFrame);
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  return <canvas ref={canvasRef} className="ambient-stage" aria-hidden="true" />;
}
