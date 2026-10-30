import { useEffect, useState } from 'react';
export function useTypewriter(text: string, speed: number, key: string) {
  const [shown, setShown] = useState({ key: '', count: 0 });
  const chars = Array.from(text),
    count = shown.key === key ? shown.count : 0,
    complete = speed === 0 || count >= chars.length;
  useEffect(() => {
    if (speed === 0 || complete) return;
    const t = setTimeout(() => setShown({ key, count: count + 1 }), speed);
    return () => clearTimeout(t);
  }, [speed, key, count, complete]);
  return {
    text: complete ? text : chars.slice(0, count).join(''),
    complete,
    reveal: () => setShown({ key, count: chars.length }),
  };
}
