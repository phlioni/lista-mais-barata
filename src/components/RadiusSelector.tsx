import { cn } from "@/lib/utils";

interface RadiusSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const radiusOptions = [
  { value: 1, label: "1 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" }, // Nova opção adicionada
];

export function RadiusSelector({ value, onChange }: RadiusSelectorProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-xl overflow-x-auto no-scrollbar">
      {radiusOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 py-2 px-3 sm:px-4 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}