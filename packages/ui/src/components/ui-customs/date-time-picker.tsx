"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

export interface IDateTimePickerProps extends Omit<
  React.ComponentProps<typeof Button>,
  "value" | "onChange" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  clampToMin?: boolean;
  placeholder?: string;
}

function parseDatetimeLocalValue(value?: string): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toDatetimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function clampDate(date: Date, minDate: Date | null, clampToMin: boolean): Date {
  if (clampToMin && minDate && date.getTime() < minDate.getTime()) {
    return new Date(minDate);
  }

  return date;
}

function buildTimeCandidate(
  currentDate: Date,
  type: "hour" | "minute" | "ampm",
  value: string,
): Date {
  const nextDate = new Date(currentDate);

  if (type === "hour") {
    const selectedHour = Number.parseInt(value, 10);
    const isPm = nextDate.getHours() >= 12;
    nextDate.setHours(isPm ? (selectedHour % 12) + 12 : selectedHour % 12);
  } else if (type === "minute") {
    nextDate.setMinutes(Number.parseInt(value, 10));
  } else {
    const hours = nextDate.getHours();
    if (value === "AM" && hours >= 12) {
      nextDate.setHours(hours - 12);
    } else if (value === "PM" && hours < 12) {
      nextDate.setHours(hours + 12);
    }
  }

  nextDate.setSeconds(0, 0);
  return nextDate;
}

function getInitialDate(valueDate: Date | null, minDate: Date | null): Date {
  if (valueDate) {
    return new Date(valueDate);
  }

  if (minDate) {
    return new Date(minDate);
  }

  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DateTimePicker({
  value,
  onValueChange,
  min,
  clampToMin = true,
  placeholder = "MM/DD/YYYY hh:mm aa",
  className,
  disabled,
  ...props
}: IDateTimePickerProps) {
  const valueDate = React.useMemo(() => parseDatetimeLocalValue(value), [value]);
  const minDate = React.useMemo(() => parseDatetimeLocalValue(min), [min]);

  const emitValue = React.useCallback(
    (date: Date) => {
      onValueChange(toDatetimeLocalValue(clampDate(date, minDate, clampToMin)));
    },
    [clampToMin, minDate, onValueChange],
  );

  const selectedDate = valueDate ?? undefined;
  const currentDate = getInitialDate(valueDate, minDate);

  const handleDateSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date) {
        return;
      }

      const nextDate = new Date(date);
      nextDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
      emitValue(nextDate);
    },
    [currentDate, emitValue],
  );

  const handleTimeChange = React.useCallback(
    (type: "hour" | "minute" | "ampm", nextValue: string) => {
      emitValue(buildTimeCandidate(currentDate, type, nextValue));
    },
    [currentDate, emitValue],
  );

  const isCandidateDisabled = React.useCallback(
    (candidate: Date) => Boolean(minDate && candidate.getTime() < minDate.getTime()),
    [minDate],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          {...props}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start border-gray-300 px-3 text-left font-normal focus:border-[#FF7003]",
            !valueDate && "text-muted-foreground",
            className,
          )}
        >
          {valueDate ? format(valueDate, "MM/dd/yyyy hh:mm aa") : <span>{placeholder}</span>}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => {
              if (!minDate) {
                return false;
              }

              const endOfDate = new Date(date);
              endOfDate.setHours(23, 59, 59, 999);
              return endOfDate.getTime() < minDate.getTime();
            }}
            initialFocus
          />
          <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {Array.from({ length: 12 }, (_, index) => index + 1)
                  .reverse()
                  .map((hour) => {
                    const candidate = buildTimeCandidate(currentDate, "hour", String(hour));
                    const isSelected = currentDate.getHours() % 12 === hour % 12;

                    return (
                      <Button
                        key={hour}
                        type="button"
                        size="icon"
                        variant={isSelected ? "default" : "ghost"}
                        disabled={isCandidateDisabled(candidate)}
                        className="aspect-square shrink-0 sm:w-full"
                        onClick={() => handleTimeChange("hour", hour.toString())}
                      >
                        {hour}
                      </Button>
                    );
                  })}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => {
                  const candidate = buildTimeCandidate(currentDate, "minute", String(minute));
                  const isSelected = currentDate.getMinutes() === minute;

                  return (
                    <Button
                      key={minute}
                      type="button"
                      size="icon"
                      variant={isSelected ? "default" : "ghost"}
                      disabled={isCandidateDisabled(candidate)}
                      className="aspect-square shrink-0 sm:w-full"
                      onClick={() => handleTimeChange("minute", minute.toString())}
                    >
                      {minute.toString().padStart(2, "0")}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            <ScrollArea>
              <div className="flex p-2 sm:flex-col">
                {["AM", "PM"].map((ampm) => {
                  const candidate = buildTimeCandidate(currentDate, "ampm", ampm);
                  const isSelected =
                    (ampm === "AM" && currentDate.getHours() < 12) ||
                    (ampm === "PM" && currentDate.getHours() >= 12);

                  return (
                    <Button
                      key={ampm}
                      type="button"
                      size="icon"
                      variant={isSelected ? "default" : "ghost"}
                      disabled={isSameDay(candidate, currentDate) && isCandidateDisabled(candidate)}
                      className="aspect-square shrink-0 sm:w-full"
                      onClick={() => handleTimeChange("ampm", ampm)}
                    >
                      {ampm}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
