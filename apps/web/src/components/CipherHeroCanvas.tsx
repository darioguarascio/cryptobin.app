import { useEffect, useRef } from 'react';

const GLYPHS = '0123456789ABCDEF';

interface Packet {
  lane: number;
  offset: number;
  speed: number;
  size: number;
}

interface NodePoint {
  x: number;
  y: number;
  pulse: number;
}

interface CanvasPalette {
  bg: string;
  grid: string;
  trace: string;
  node: string;
  link: string;
  packetA: string;
  packetB: string;
  packetC: string;
  glyph: string;
  cell: string;
  cellText: string;
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function CipherHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cnv = canvasRef.current;

    if (!cnv) {
      return undefined;
    }

    const ctx = cnv.getContext('2d');

    if (!ctx) {
      return undefined;
    }

    const liveCanvas: HTMLCanvasElement = cnv;
    const liveContext: CanvasRenderingContext2D = ctx;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let palette: CanvasPalette = readPalette();

    const packets: Packet[] = Array.from({ length: 14 }, (_, index) => ({
      lane: index % 9,
      offset: Math.random(),
      speed: 0.000025 + Math.random() * 0.000055,
      size: 1 + Math.random() * 2,
    }));

    const nodes: NodePoint[] = Array.from({ length: 13 }, () => ({
      x: Math.random(),
      y: Math.random(),
      pulse: Math.random() * Math.PI * 2,
    }));

    function readPalette(): CanvasPalette {
      return {
        bg: cssVar('--canvas-bg', '#0a0d0c'),
        grid: cssVar('--canvas-grid', 'rgba(143, 216, 196, 0.08)'),
        trace: cssVar('--canvas-trace', 'rgba(212, 176, 106, 0.1)'),
        node: cssVar('--canvas-node', 'rgba(244, 242, 236, 0.32)'),
        link: cssVar('--canvas-link', 'rgba(143, 216, 196, 0.11)'),
        packetA: cssVar('--canvas-packet-a', '#d4b06a'),
        packetB: cssVar('--canvas-packet-b', '#8fd8c4'),
        packetC: cssVar('--canvas-packet-c', '#ff8c7a'),
        glyph: cssVar('--canvas-glyph', 'rgba(244, 242, 236, 0.46)'),
        cell: cssVar('--canvas-cell', 'rgba(143, 216, 196, 0.13)'),
        cellText: cssVar('--canvas-cell-text', 'rgba(244, 242, 236, 0.32)'),
      };
    }

    function resize() {
      palette = readPalette();
      const rect = liveCanvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      liveCanvas.width = Math.floor(width * pixelRatio);
      liveCanvas.height = Math.floor(height * pixelRatio);
      liveContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function draw(timestamp: number) {
      liveContext.clearRect(0, 0, width, height);

      const grid = Math.max(38, Math.min(72, width / 13));
      liveContext.fillStyle = palette.bg;
      liveContext.fillRect(0, 0, width, height);

      liveContext.strokeStyle = palette.grid;
      liveContext.lineWidth = 1;
      for (let x = -grid; x < width + grid; x += grid) {
        liveContext.beginPath();
        liveContext.moveTo(x + ((timestamp * 0.006) % grid), 0);
        liveContext.lineTo(x - height * 0.26 + ((timestamp * 0.006) % grid), height);
        liveContext.stroke();
      }

      liveContext.strokeStyle = palette.trace;
      for (let y = grid * 0.5; y < height; y += grid * 1.2) {
        liveContext.beginPath();
        liveContext.moveTo(0, y);
        liveContext.lineTo(width, y + Math.sin(timestamp * 0.0005 + y) * 16);
        liveContext.stroke();
      }

      nodes.forEach((node, index) => {
        const x = node.x * width;
        const y = node.y * height;
        const pulse = 0.5 + Math.sin(timestamp * 0.002 + node.pulse) * 0.5;

        liveContext.fillStyle = palette.node;
        liveContext.beginPath();
        liveContext.arc(x, y, 1.2 + pulse * 1.6, 0, Math.PI * 2);
        liveContext.fill();

        const next = nodes[(index + 5) % nodes.length];
        const distance = Math.hypot(next.x - node.x, next.y - node.y);

        if (distance < 0.52) {
          liveContext.strokeStyle = palette.link;
          liveContext.beginPath();
          liveContext.moveTo(x, y);
          liveContext.lineTo(next.x * width, next.y * height);
          liveContext.stroke();
        }
      });

      packets.forEach((packet, index) => {
        const progress = (packet.offset + timestamp * packet.speed) % 1;
        const y = 36 + packet.lane * ((height - 72) / 8);
        const x = progress * (width + 160) - 80;
        const tone =
          index % 3 === 0 ? palette.packetA : index % 3 === 1 ? palette.packetB : palette.packetC;

        liveContext.fillStyle = tone;
        liveContext.globalAlpha = 0.34;
        liveContext.fillRect(x, y, 34 + packet.size * 5, 1.5);
        liveContext.globalAlpha = 0.08;
        liveContext.fillRect(x - 22, y - 1, 22, 3);
        liveContext.globalAlpha = 1;

        liveContext.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
        liveContext.fillStyle = palette.glyph;
        const glyph = `${GLYPHS[(index + packet.lane) % GLYPHS.length]}${GLYPHS[(index * 3) % GLYPHS.length]}`;
        liveContext.fillText(glyph, x + 4, y - 7);
      });

      const matrixSize = Math.min(190, width * 0.3);
      const startX = width - matrixSize - 34;
      const startY = height - matrixSize - 30;
      const cell = matrixSize / 6;

      liveContext.font = `${Math.max(12, cell * 0.32)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 6; col += 1) {
          const flicker = Math.sin(timestamp * 0.004 + row * 1.7 + col * 2.1);
          liveContext.globalAlpha = 0.5 + Math.max(0, flicker) * 0.18;
          liveContext.fillStyle = palette.cell;
          liveContext.fillRect(startX + col * cell, startY + row * cell, cell - 4, cell - 4);
          liveContext.globalAlpha = 0.72;
          liveContext.fillStyle = palette.cellText;
          liveContext.fillText(
            GLYPHS[(row * 7 + col * 3 + Math.floor(timestamp / 500)) % GLYPHS.length],
            startX + col * cell + cell * 0.34,
            startY + row * cell + cell * 0.58,
          );
          liveContext.globalAlpha = 1;
        }
      }

      if (!reducedMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    }

    resize();
    const onThemeChange = () => {
      palette = readPalette();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('cryptobin:theme-change', onThemeChange);
    animationFrame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('cryptobin:theme-change', onThemeChange);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas className="cipher-hero-canvas" ref={canvasRef} aria-hidden="true" />;
}
