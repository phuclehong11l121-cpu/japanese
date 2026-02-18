
import React from 'react';
import { MnemonicResponse, JapaneseChar } from '../types';
import { KANJI_N5, VOCABULARY_N5, HIRAGANA, KATAKANA } from '../constants';

interface MnemonicDisplayProps {
  mnemonic: MnemonicResponse;
  onClose: () => void;
}

const MnemonicDisplay: React.FC<MnemonicDisplayProps> = ({ mnemonic, onClose }) => {
  // Find the character data to display extra reference info
  const charData = [...KANJI_N5, ...VOCABULARY_N5, ...HIRAGANA, ...KATAKANA].find(c => c.char === mnemonic.character);

  const openExternal = (site: 'jisho' | 'google') => {
    const query = mnemonic.character;
    const url = site === 'jisho' 
      ? `https://jisho.org/search/${encodeURIComponent(query)}`
      : `https://www.google.com/search?q=${encodeURIComponent(query + ' meaning japanese')}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-amber-50 rounded-3xl p-8 border-2 border-amber-200 shadow-inner mt-8 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 p-2 rounded-lg text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-amber-900">Study Guide</h3>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Detailed Kanji Reference Section */}
        {charData?.type === 'kanji' && (
          <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm space-y-5">
             <div className="flex items-start gap-4 pb-4 border-b border-slate-50">
                <div className="text-5xl font-jp font-bold text-slate-800 bg-slate-50 w-16 h-16 flex items-center justify-center rounded-xl">{charData.char}</div>
                <div className="flex-1">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Japanese Meaning</h4>
                   <p className="text-xl font-bold text-slate-800">{charData.meaning}</p>
                   {charData.sinoVietnamese && (
                     <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Hán Việt:</span>
                        <span className="text-md font-bold text-indigo-600 uppercase tracking-wide">{charData.sinoVietnamese}</span>
                     </div>
                   )}
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">On-yomi</h4>
                   <p className="text-md font-bold text-slate-700 font-jp leading-tight">{charData.onyomi || '—'}</p>
                </div>
                <div>
                   <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Kun-yomi</h4>
                   <p className="text-md font-bold text-slate-700 font-jp leading-tight">{charData.kunyomi || '—'}</p>
                </div>
             </div>

             {charData.exampleVocab && (
               <div className="pt-4 border-t border-slate-50">
                  <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Example Vocabulary</h4>
                  <p className="text-md font-bold text-slate-800 font-jp">{charData.exampleVocab}</p>
               </div>
             )}
          </div>
        )}

        <div>
          <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2">Sensei's Mnemonic</h4>
          <p className="text-slate-800 text-lg leading-relaxed bg-amber-100/30 p-4 rounded-xl italic border border-amber-100 shadow-sm">
            "{mnemonic.mnemonic}"
          </p>
        </div>
        
        <div className="bg-white/50 p-4 rounded-xl border border-amber-100">
          <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Full Example Sentence</h4>
          <p className="text-2xl font-jp mb-1 text-slate-900 leading-tight">{mnemonic.exampleSentence}</p>
          <p className="text-slate-600 italic text-sm">{mnemonic.translation}</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button 
            onClick={() => openExternal('jisho')}
            className="flex-1 px-3 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 shadow-md shadow-indigo-100"
          >
            Jisho Dictionary
          </button>
          <button 
            onClick={() => openExternal('google')}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 shadow-sm"
          >
            Search Web
          </button>
        </div>
      </div>
    </div>
  );
};

export default MnemonicDisplay;
