import { APP } from '../../config/app';

/** Inhalt einer Story-Karte; bewusst ohne Ausgaben und Getränke, weil die Karten geteilt werden */
export interface Card {
  kicker: string;
  big: string;
  bigLabel: string;
  lines: { emoji: string; label: string; value: string }[];
}

const W = 1080;
const H = 1920;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';

function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, weight = 700): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > max && s > 24) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

/** Zeichnet eine Karte im Hochformat 1080 × 1920 und liefert sie als PNG */
export async function renderCard(card: Card, index: number, total: number): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2a0f2f');
  bg.addColorStop(0.55, '#140f24');
  bg.addColorStop(1, '#0f0d16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(180, 220, 700, 'rgba(255,79,163,0.45)');
  glow(980, 1650, 750, 'rgba(139,92,246,0.45)');

  const accent = ctx.createLinearGradient(80, 0, 1000, 0);
  accent.addColorStop(0, '#ff4fa3');
  accent.addColorStop(1, '#8b5cf6');

  // Fortschrittsbalken wie bei Stories
  const gap = 12;
  const bw = (W - 160 - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i <= index ? '#ffffff' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(80 + i * (bw + gap), 90, bw, 8, 4);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText(card.kicker.toUpperCase(), 80, 230);

  ctx.fillStyle = accent;
  const size = fit(ctx, card.big, W - 160, 260, 800);
  ctx.fillText(card.big, 80, 230 + 40 + size);
  ctx.fillStyle = '#ffffff';
  fit(ctx, card.bigLabel, W - 160, 64, 700);
  ctx.fillText(card.bigLabel, 80, 230 + 40 + size + 90);

  let y = 900;
  for (const line of card.lines) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(80, y, W - 160, 190, 36);
    ctx.fill();
    ctx.font = `400 84px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line.emoji, 120, y + 125);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `600 36px ${FONT}`;
    ctx.fillText(line.label, 250, y + 75);
    ctx.fillStyle = '#ffffff';
    fit(ctx, line.value, W - 160 - 200, 58, 700);
    ctx.fillText(line.value, 250, y + 145);
    y += 220;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(APP.name, 80, H - 110);
  ctx.textAlign = 'right';
  ctx.font = `400 32px ${FONT}`;
  ctx.fillText('Trink verantwortungsvoll', W - 80, H - 110);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'));
}
