/** 大乐透：前区 5 个（1–35），后区 2 个（1–12），号码升序、两位补零 */
export interface LottoPick {
  front: string[];
  back: string[];
}

export function rollLotto(): LottoPick {
  const pick = (max: number, count: number): number[] => {
    const pool = Array.from({ length: max }, (_, i) => i + 1);
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out.sort((a, b) => a - b);
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    front: pick(35, 5).map(pad),
    back: pick(12, 2).map(pad),
  };
}
