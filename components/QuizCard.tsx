
import React, { useState, useEffect } from 'react';
import { JapaneseChar } from '../types';

interface QuizCardProps {
  character: JapaneseChar;
  options: string[];
  onAnswer: (answer: string) => void;
  isProcessing: boolean;
}

const QuizCard: React.FC<QuizCardProps> = ({ 
  character, 
  options, 
  onAnswer, 
  isProcessing
}) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [character]);

  const handleSelect = (option: string) => {
    if (isProcessing) return;
    setSelected(option);
    onAnswer(option);
  };

  const openLookup = () => {
    const query = character.type === 'kanji' ? `${character.char}#kanji` : character.char;
    window.open(`https://jisho.org/search/${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 max-w-md w-full animate-in fade-in zoom-in duration-300">
      <div className="text-center mb-10 relative">
        <div className="flex justify-center mb-4">
          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
            {character.type}
          </span>
        </div>
        
        <div className="relative group flex flex-col items-center">
          <h2 className="text-8xl font-bold text-slate-800 font-jp mb-1">{character.char}</h2>
          
          <button 
            onClick={openLookup}
            className="mt-6 text-indigo-300 hover:text-indigo-600 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Study Resource
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {options.map((opt) => (
          <button
            key={opt}
            disabled={isProcessing}
            onClick={() => handleSelect(opt)}
            className={`
              p-4 rounded-2xl text-xl font-bold border-2 transition-all flex items-center justify-center gap-2
              ${selected === opt 
                ? (opt === (character.type === 'kanji' || character.type === 'vocabulary' ? character.meaning : character.romaji)
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-rose-500 bg-rose-50 text-rose-700')
                : 'border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700'
              }
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuizCard;
