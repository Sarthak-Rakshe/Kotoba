import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Layers, Calendar } from 'lucide-react';
import { api } from '../api/client';
import type { HourlyForecastItem, DailyForecastItem } from '../types';

export const ReviewForecastChart: React.FC = () => {
  const [viewMode, setViewMode] = useState<'24h' | '7d'>('24h');
  const [hoveredHour, setHoveredHour] = useState<HourlyForecastItem | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DailyForecastItem | null>(null);

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['reviewForecast'],
    queryFn: api.reviews.getForecast,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="glass-panel p-5 rounded-3xl shadow-xl animate-pulse">
        <div className="h-5 w-44 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-3" />
        <div className="h-28 bg-zinc-100 dark:bg-[#0c0d12] rounded-2xl" />
      </div>
    );
  }

  if (!forecast) return null;

  const maxHourlyCount = Math.max(...forecast.next24Hours.map((h) => h.count), 1);
  const maxDailyCount = Math.max(...forecast.next7Days.map((d) => d.count), 1);
  const totalNext24h = forecast.next24Hours.reduce((acc, curr) => acc + curr.count, 0);
  const totalNext7d = forecast.next7Days.reduce((acc, curr) => acc + curr.count, 0);

  // Helper to format exact time interval on hover
  const formatExactHour = (timestampStr: string) => {
    try {
      const d = new Date(timestampStr);
      const now = new Date();

      const isToday = d.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();

      const dayPrefix = isToday
        ? 'Today'
        : isTomorrow
        ? 'Tomorrow'
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

      const startTime = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const endDate = new Date(d);
      endDate.setHours(d.getHours() + 1);
      const endTime = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      return `${dayPrefix} at ${startTime} – ${endTime}`;
    } catch {
      return timestampStr;
    }
  };

  const formatExactDay = (dateStr: string, dayLabel: string) => {
    try {
      const d = new Date(dateStr);
      const dateFormatted = d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      return `${dayLabel} (${dateFormatted})`;
    } catch {
      return dayLabel;
    }
  };

  return (
    <section className="glass-panel p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-xl bg-red-600/10 border border-red-600/20 text-red-600 dark:text-rose-400">
            <Clock className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
              Review Forecast
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Spaced repetition retention schedule
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Due Now Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-600/10 dark:bg-red-500/10 border border-red-600/20 text-xs font-semibold text-red-600 dark:text-rose-400">
            <Layers className="w-3.5 h-3.5" />
            <span>
              Due Now: <strong className="font-mono">{forecast.dueNow}</strong>
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-zinc-100 dark:bg-[#0c0d12] p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
            <button
              onClick={() => {
                setViewMode('24h');
                setHoveredDay(null);
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === '24h'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Next 24h
            </button>
            <button
              onClick={() => {
                setViewMode('7d');
                setHoveredHour(null);
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === '7d'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              7 Days
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Hover Status Banner */}
      <div className="min-h-[28px] flex items-center">
        {viewMode === '24h' ? (
          hoveredHour ? (
            <div className="w-full flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-white bg-red-600/10 dark:bg-red-500/10 border border-red-600/20 px-3 py-1.5 rounded-xl animate-in fade-in duration-150">
              <Clock className="w-3.5 h-3.5 text-red-600 dark:text-rose-400 shrink-0" />
              <span>
                Exact Time: <strong className="text-red-600 dark:text-rose-400 font-bold">{formatExactHour(hoveredHour.timestamp)}</strong>
              </span>
              <span className="text-zinc-400">·</span>
              <span>
                <strong>+{hoveredHour.count} reviews due</strong>
              </span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {hoveredHour.cumulativeCount} accumulated in queue
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Next 24 Hours: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{totalNext24h} incoming reviews</strong>
              </span>
              <span>·</span>
              <span className="text-[11px] italic">Hover any hourly box to see exact time</span>
            </div>
          )
        ) : hoveredDay ? (
          <div className="w-full flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-white bg-red-600/10 dark:bg-red-500/10 border border-red-600/20 px-3 py-1.5 rounded-xl animate-in fade-in duration-150">
            <Calendar className="w-3.5 h-3.5 text-red-600 dark:text-rose-400 shrink-0" />
            <span>
              Target: <strong className="text-red-600 dark:text-rose-400 font-bold">{formatExactDay(hoveredDay.date, hoveredDay.dayLabel)}</strong>
            </span>
            <span className="text-zinc-400">·</span>
            <span>
              <strong>{hoveredDay.count} reviews scheduled</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Next 7 Days: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{totalNext7d} reviews scheduled</strong>
            </span>
            <span>·</span>
            <span className="text-[11px] italic">Hover any day to inspect workload</span>
          </div>
        )}
      </div>

      {/* View: 24 Hours (WaniKani Vertical Short Boxes Row) */}
      {viewMode === '24h' && (
        <div className="overflow-x-auto pb-2 pt-6 -mx-1 px-1">
          <div className="flex items-center gap-2 min-w-max">
            {forecast.next24Hours.map((slot, idx) => {
              const hasReviews = slot.count > 0;
              // Bar height in percentage (from 0% to 100%)
              const barHeight = hasReviews
                ? Math.max(Math.round((slot.count / maxHourlyCount) * 100), 20)
                : 0;
              const isHovered = hoveredHour?.timestamp === slot.timestamp;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredHour(slot)}
                  onMouseLeave={() => setHoveredHour(null)}
                  className={`w-[52px] sm:w-[58px] h-32 flex flex-col items-center justify-between p-2 rounded-2xl border transition-all duration-200 cursor-pointer select-none relative group ${
                    isHovered
                      ? 'border-red-500 bg-red-500/10 dark:bg-red-950/30 scale-105 shadow-md shadow-red-950/20 z-20'
                      : hasReviews
                      ? 'border-red-500/40 bg-red-500/[0.04] dark:bg-red-950/10'
                      : 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0c0d12] hover:border-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Floating Tooltip with exact time & counts (rendered above with safe bounds) */}
                  {isHovered && (
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-30 bg-zinc-950 text-white text-[10px] px-2.5 py-1.5 rounded-xl shadow-2xl border border-zinc-700 pointer-events-none whitespace-nowrap flex flex-col items-center">
                      <span className="font-bold text-rose-300">{formatExactHour(slot.timestamp)}</span>
                      <span className="text-zinc-300">+{slot.count} reviews · Total: {slot.cumulativeCount}</span>
                      <div className="w-2 h-2 bg-zinc-950 border-b border-r border-zinc-700 rotate-45 -mb-2 mt-0.5" />
                    </div>
                  )}

                  {/* Top: Hour Label */}
                  <span
                    className={`text-[10px] font-mono font-bold leading-none ${
                      isHovered
                        ? 'text-red-600 dark:text-rose-400'
                        : hasReviews
                        ? 'text-zinc-900 dark:text-white'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {slot.timeLabel}
                  </span>

                  {/* Center: Vertical Pill Track & Bar */}
                  <div className="w-2.5 h-14 rounded-full bg-zinc-200 dark:bg-zinc-800/90 flex items-end overflow-hidden p-0.5 my-1">
                    <div
                      style={{ height: `${barHeight}%` }}
                      className={`w-full rounded-full transition-all duration-300 ${
                        hasReviews
                          ? 'bg-gradient-to-t from-red-700 via-rose-600 to-amber-400 shadow-xs'
                          : 'h-0'
                      }`}
                    />
                  </div>

                  {/* Bottom: Count */}
                  <span
                    className={`text-xs font-mono font-bold leading-none ${
                      hasReviews
                        ? 'text-red-600 dark:text-rose-400 font-black'
                        : 'text-zinc-400 dark:text-zinc-600 font-normal'
                    }`}
                  >
                    {hasReviews ? `+${slot.count}` : '0'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View: 7 Days (WaniKani Vertical Short Boxes Row) */}
      {viewMode === '7d' && (
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 pt-2">
          {forecast.next7Days.map((day, idx) => {
            const hasReviews = day.count > 0;
            const barHeight = hasReviews
              ? Math.max(Math.round((day.count / maxDailyCount) * 100), 20)
              : 0;
            const isHovered = hoveredDay?.date === day.date;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`h-32 flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer relative group ${
                  isHovered
                    ? 'border-red-500 bg-red-500/10 dark:bg-red-950/30 scale-105 shadow-md shadow-red-950/20 z-20'
                    : hasReviews
                    ? 'border-red-500/40 bg-red-500/[0.04] dark:bg-red-950/10'
                    : 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0c0d12] hover:border-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                {/* Floating Tooltip */}
                {isHovered && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 bg-zinc-950 text-white text-[10px] px-2.5 py-1.5 rounded-xl shadow-2xl border border-zinc-700 pointer-events-none whitespace-nowrap flex flex-col items-center">
                    <span className="font-bold text-rose-300">{formatExactDay(day.date, day.dayLabel)}</span>
                    <span className="text-zinc-300">{day.count} reviews scheduled</span>
                    <div className="w-2 h-2 bg-zinc-950 border-b border-r border-zinc-700 rotate-45 -mb-2 mt-0.5" />
                  </div>
                )}

                {/* Top: Day Name */}
                <div className="text-center">
                  <span
                    className={`text-xs font-bold block ${
                      isHovered
                        ? 'text-red-600 dark:text-rose-400'
                        : hasReviews
                        ? 'text-zinc-900 dark:text-white'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {day.dayLabel}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono">
                    {new Date(day.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>

                {/* Center: Vertical Bar Track */}
                <div className="w-2.5 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800/90 flex items-end overflow-hidden p-0.5 my-1">
                  <div
                    style={{ height: `${barHeight}%` }}
                    className={`w-full rounded-full transition-all duration-300 ${
                      hasReviews
                        ? 'bg-gradient-to-t from-red-700 via-rose-600 to-teal-400 shadow-xs'
                        : 'h-0'
                    }`}
                  />
                </div>

                {/* Bottom: Count */}
                <span
                  className={`text-xs font-mono font-bold ${
                    hasReviews
                      ? 'text-red-600 dark:text-rose-400 font-black'
                      : 'text-zinc-400 dark:text-zinc-600 font-normal'
                  }`}
                >
                  {hasReviews ? day.count : '0'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
