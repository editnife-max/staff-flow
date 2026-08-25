import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/use-dark-mode";

export function DarkModeToggle({ className }: { className?: string }) {
  const { dark, mounted, toggle } = useDarkMode();
  // Render an identical-size placeholder until client-side theme is known
  if (!mounted) {
    return <Button variant="ghost" size="icon" className={className ?? "h-8 w-8"} disabled aria-hidden="true" />;
  }
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className={className ?? "h-8 w-8"} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
