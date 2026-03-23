import { Inter, Playfair_Display, Lora, Montserrat } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', variable: '--font-playfair' });
const lora = Lora({ subsets: ['latin'], display: 'swap', variable: '--font-lora' });
const montserrat = Montserrat({ subsets: ['latin'], display: 'swap', variable: '--font-montserrat' });

const FONT_MAP: Record<string, { className: string; variable: string }> = {
  'Inter': inter,
  'Playfair Display': playfair,
  'Lora': lora,
  'Montserrat': montserrat,
};

export function getFontClasses(headingFont: string, bodyFont: string): string {
  const heading = FONT_MAP[headingFont] ?? inter;
  const body = FONT_MAP[bodyFont] ?? inter;
  const classes = new Set([heading.variable, body.variable]);
  return Array.from(classes).join(' ');
}
