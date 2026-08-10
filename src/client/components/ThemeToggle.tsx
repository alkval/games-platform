import { useEffect, useState } from 'react';

type ThemeMode = 'auto' | 'light' | 'dark';

const modes: ThemeMode[] = ['auto', 'light', 'dark'];
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

function applyMode(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'auto' && media.matches);
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.colorScheme = dark ? 'dark' : 'light';
  document.querySelector<HTMLMetaElement>('#theme-color')?.setAttribute('content', dark ? '#14140f' : '#f7f3eb');
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(readMode);

  useEffect(() => {
    applyMode(mode);
    const followSystem = () => mode === 'auto' && applyMode('auto');
    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, [mode]);

  const cycleTheme = () => {
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    try {
      if (next === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch { /* keep the preference for this visit */ }
    setMode(next);
  };

  return (
    <button
      className="theme-button"
      type="button"
      data-mode={mode}
      aria-label={`Colour theme: ${mode}. Click to change.`}
      title={`Theme: ${mode}`}
      onClick={cycleTheme}
    >
      <span className="theme-dot" aria-hidden="true" />
      <span className="theme-label">{mode}</span>
    </button>
  );
}
