import * as React from "react";
import { format, subDays, startOfDay, endOfDay, startOfToday, startOfMonth, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";

export interface DatePickerWithRangeProps {
  className?: string;
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: DatePickerWithRangeProps) {
  const presets = [
    { label: "Hoje", getValue: () => ({ from: startOfToday(), to: endOfDay(new Date()) }) },
    { label: "Últimos 7 dias", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Últimos 15 dias", getValue: () => ({ from: subDays(new Date(), 15), to: new Date() }) },
    { label: "Últimos 30 dias", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "Este Mês", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
    { label: "Mês Passado", getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(lastMonth), to: endOfDay(subMonths(new Date(), 1)) };
    }},
  ];

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-auto justify-start text-left font-normal bg-card border-muted-foreground/20",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd LLL", { locale: ptBR })} -{" "}
                  {format(date.to, "dd LLL", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd LLL", { locale: ptBR })
              )
            ) : (
              <span>Filtrar data</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col md:flex-row" align="end">
          <div className="flex flex-col border-b md:border-b-0 md:border-r p-2 bg-muted/20 min-w-[140px]">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start font-normal text-xs h-8"
                onClick={() => setDate(preset.getValue())}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={1}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
