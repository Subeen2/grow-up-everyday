import { useState } from 'react';

export function useCelebrateOnCorrect(onCorrect: () => void) {
  const [celebrating, setCelebrating] = useState(false);

  function celebrateAndAdvance() {
    setCelebrating(true);
    onCorrect();
  }

  return { celebrating, setCelebrating, celebrateAndAdvance };
}
