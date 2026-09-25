import React from 'react';
import type { SubjectType, SrsStage } from '../types';

interface SubjectBadgeProps {
  character: string;
  type: SubjectType;
  primaryMeaning?: string;
  primaryReading?: string;
  stage?: SrsStage;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  onClick?: () => void;
}

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  character,
  type,
  primaryMeaning,
  primaryReading,
  stage,
  size = 'md',
  onClick,
}) => {
  const getTypeColors = () => {
    switch (type) {
      case 'Radical':
        return 'bg-[#00a1f1] hover:bg-[#0093dd] text-white border-[#0089cf] shadow-sm shadow-[#00a1f1]/20';
      case 'Kanji':
        return 'bg-[#f100a1] hover:bg-[#dc0093] text-white border-[#c90086] shadow-sm shadow-[#f100a1]/20';
      case 'Vocabulary':
        return 'bg-[#a100f1] hover:bg-[#9300dd] text-white border-[#8a00cf] shadow-sm shadow-[#a100f1]/20';
    }
  };

  const getStageIndicator = () => {
    if (!stage || stage === 'Locked') return null;
    let bg = 'bg-black/25 text-white';
    let text: string = stage;

    if (stage.startsWith('Apprentice')) {
      bg = 'bg-sky-950/40 text-sky-200 border border-sky-300/30';
      text = 'Appr';
    } else if (stage.startsWith('Guru')) {
      bg = 'bg-emerald-950/40 text-emerald-200 border border-emerald-300/30';
      text = 'Guru';
    } else if (stage === 'Master') {
      bg = 'bg-teal-950/40 text-teal-200 border border-teal-300/30';
      text = 'Master';
    } else if (stage === 'Enlightened') {
      bg = 'bg-amber-950/40 text-amber-200 border border-amber-300/30';
      text = 'Enlight';
    } else if (stage === 'Burned') {
      bg = 'bg-zinc-900/60 text-zinc-300 border border-zinc-500/40';
      text = 'Burned';
    } else if (stage === 'Initiate') {
      bg = 'bg-white/25 text-white border border-white/30';
      text = 'New';
    }

    return (
      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${bg} shrink-0`}>
        {text}
      </span>
    );
  };

  const sizeClasses = {
    sm: 'min-h-[5rem] w-full',
    md: 'min-h-[7.25rem] w-full',
    lg: 'min-h-[9rem] w-full',
    hero: 'min-h-[13rem] w-full',
  };

  const charSize = {
    sm: 'text-xl',
    md: character.length > 2 ? 'text-2xl' : 'text-3xl',
    lg: character.length > 2 ? 'text-4xl' : 'text-5xl',
    hero: 'text-7xl',
  };

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all duration-150 select-none ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''
      } ${getTypeColors()} ${sizeClasses[size]}`}
    >
      <div className="w-full flex justify-between items-center gap-1">
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-90 truncate">
          {type}
        </span>
        {getStageIndicator()}
      </div>

      <div className={`font-japanese font-medium my-auto py-1 text-center leading-none text-white ${charSize[size]}`}>
        {character}
      </div>

      <div className="w-full text-center space-y-0.5">
        {primaryReading && (
          <div className="font-japanese text-[11px] font-normal opacity-95 truncate leading-tight">
            {primaryReading}
          </div>
        )}
        {primaryMeaning && (
          <div className="text-xs font-semibold truncate text-white leading-tight">
            {primaryMeaning}
          </div>
        )}
      </div>
    </div>
  );
};
