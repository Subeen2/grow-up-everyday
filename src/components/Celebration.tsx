import { CSSProperties, useEffect } from 'react';

interface CelebrationProps {
  onDone: () => void;
  duration?: number;
}

const PIECES = ['🎉', '✨', '🎊', '⭐', '✨'];

export function Celebration({ onDone, duration = 1200 }: CelebrationProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [onDone, duration]);

  return (
    <div className="celebration" role="status" aria-label="정답!">
      {PIECES.map((piece, i) => (
        <span key={i} className="celebration__piece" style={{ '--i': i } as CSSProperties}>
          {piece}
        </span>
      ))}
    </div>
  );
}
