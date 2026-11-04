import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ThemeToggle = ({ expanded = true }: { expanded?: boolean }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-3 px-1 min-h-[44px] [&_svg]:size-5"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
      {expanded && (isDark ? 'Modo Claro' : 'Modo Escuro')}
    </Button>
  );
};

export default ThemeToggle;
