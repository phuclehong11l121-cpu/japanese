
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HIRAGANA, KATAKANA, KANJI_N5, VOCABULARY_N5, GRAMMAR_N5 } from './constants';
import { JapaneseChar, QuizState, CharacterType, UserProgress, MnemonicResponse, GrammarPoint, ProgressStatus, ProficiencyLevel } from './types';
import { getMnemonicForChar } from './services/geminiService';
import Button from './components/Button';
import QuizCard from './components/QuizCard';
import MnemonicDisplay from './components/MnemonicDisplay';

const MASTERY_THRESHOLD = 3;
const PROFICIENCY_INTERMEDIATE = 5;
const PROFICIENCY_ADVANCED = 8;
const INITIAL_INTRO_COUNT = 10;

const App: React.FC = () => {
  // State
  const [view, setView] = useState<'home' | 'quiz' | 'review' | 'vocab-list' | 'grammar-list' | 'progress-overview'>('home');
  const [activeType, setActiveType] = useState<CharacterType>('hiragana');
  const [quiz, setQuiz] = useState<QuizState>({
    isActive: false,
    currentIndex: 0,
    score: 0,
    questions: [],
    mistakes: []
  });
  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem('japanese-progress');
    return saved ? (JSON.parse(saved) as UserProgress) : { masteredIds: [], weakIds: {}, successCounts: {} };
  });
  const [mnemonic, setMnemonic] = useState<MnemonicResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [unlockNotification, setUnlockNotification] = useState<JapaneseChar | null>(null);
  const [vocabSearch, setVocabSearch] = useState('');
  const [grammarSearch, setGrammarSearch] = useState('');
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const prevDiscoveredCounts = useRef<Record<string, number>>({
    hiragana: INITIAL_INTRO_COUNT,
    katakana: INITIAL_INTRO_COUNT,
    kanji: INITIAL_INTRO_COUNT,
    vocabulary: INITIAL_INTRO_COUNT,
  });

  // Check for mandatory API key selection on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (e) {
          setHasKey(true); // Fallback for environments where key is pre-set
        }
      } else {
        setHasKey(true); // Default for local or standard web environments
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem('japanese-progress', JSON.stringify(progress));
  }, [progress]);

  const totalMasteredCount = progress.masteredIds.length;

  const getDiscoveredPool = (fullPool: JapaneseChar[]) => {
    const categoryMasteredCount = fullPool.filter(c => progress.masteredIds.includes(c.id)).length;
    const allowedCount = INITIAL_INTRO_COUNT + categoryMasteredCount;
    return fullPool.slice(0, Math.min(allowedCount, fullPool.length));
  };

  const unlockedSets = useMemo(() => ({
    hiragana: getDiscoveredPool(HIRAGANA),
    katakana: getDiscoveredPool(KATAKANA),
    kanji: getDiscoveredPool(KANJI_N5),
    vocabulary: getDiscoveredPool(VOCABULARY_N5)
  }), [progress.masteredIds]);

  const combinedDiscoveredPool = useMemo(() => [
    ...unlockedSets.hiragana,
    ...unlockedSets.katakana,
    ...unlockedSets.kanji,
    ...unlockedSets.vocabulary
  ], [unlockedSets]);

  const filteredVocab = useMemo(() => {
    return VOCABULARY_N5.filter(v => 
      v.char.includes(vocabSearch) || 
      v.meaning?.toLowerCase().includes(vocabSearch.toLowerCase()) ||
      v.romaji.toLowerCase().includes(vocabSearch.toLowerCase())
    );
  }, [vocabSearch]);

  const filteredGrammar = useMemo(() => {
    return GRAMMAR_N5.filter(g => 
      g.title.toLowerCase().includes(grammarSearch.toLowerCase()) || 
      g.explanation.toLowerCase().includes(grammarSearch.toLowerCase())
    );
  }, [grammarSearch]);

  const openDictionary = (char: string, type: CharacterType) => {
    const query = type === 'kanji' ? `${char}#kanji` : char;
    window.open(`https://jisho.org/search/${encodeURIComponent(query)}`, '_blank');
  };

  useEffect(() => {
    if (view !== 'home') return;
    const categories: CharacterType[] = ['hiragana', 'katakana', 'kanji', 'vocabulary'];
    for (const cat of categories) {
      const pool = unlockedSets[cat as keyof typeof unlockedSets];
      if (pool && pool.length > prevDiscoveredCounts.current[cat]) {
        const newChar = pool[pool.length - 1];
        setUnlockNotification(newChar);
        setTimeout(() => setUnlockNotification(null), 5000);
      }
      prevDiscoveredCounts.current[cat] = pool ? pool.length : INITIAL_INTRO_COUNT;
    }
  }, [unlockedSets, view]);

  const startQuiz = (type: CharacterType, reviewMistakes = false) => {
    let sessionPool: JapaneseChar[] = [];
    let count = 10;
    if (type === 'general') {
      sessionPool = [...combinedDiscoveredPool];
      count = 20;
    } else {
      sessionPool = [...unlockedSets[type as keyof typeof unlockedSets]];
    }
    if (reviewMistakes) {
      sessionPool = sessionPool.filter(c => progress.weakIds[c.id]);
      if (sessionPool.length === 0) {
        alert("No mistakes tracked in your active discovery set yet!");
        return;
      }
    }
    const shuffled = sessionPool.sort(() => Math.random() - 0.5).slice(0, count);
    setQuiz({ isActive: true, currentIndex: 0, score: 0, questions: shuffled, mistakes: [] });
    setActiveType(type);
    setView('quiz');
    setMnemonic(null);
  };

  const currentQuestion = quiz.questions[quiz.currentIndex];

  const options = useMemo(() => {
    if (!currentQuestion) return [];
    const isMeaningQuestion = currentQuestion.type === 'kanji' || currentQuestion.type === 'vocabulary';
    const correctAnswer = isMeaningQuestion ? currentQuestion.meaning! : currentQuestion.romaji;
    const pool = isMeaningQuestion ? [...KANJI_N5, ...VOCABULARY_N5] : [...HIRAGANA, ...KATAKANA];
    const wrongOptions = pool
      .filter(c => c.id !== currentQuestion.id)
      .map(c => (c.type === 'kanji' || c.type === 'vocabulary') ? c.meaning! : c.romaji)
      .filter((v, i, a) => a.indexOf(v) === i && v !== correctAnswer) 
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5);
  }, [currentQuestion]);

  const handleAnswer = async (answer: string) => {
    setIsProcessing(true);
    const isMeaningQuestion = currentQuestion.type === 'kanji' || currentQuestion.type === 'vocabulary';
    const correctAnswer = isMeaningQuestion ? currentQuestion.meaning : currentQuestion.romaji;
    const isCorrect = answer === correctAnswer;
    if (isCorrect) {
      setQuiz(prev => ({ ...prev, score: prev.score + 1 }));
      setProgress(prev => {
        const newSuccess = { ...prev.successCounts };
        newSuccess[currentQuestion.id] = (newSuccess[currentQuestion.id] || 0) + 1;
        const newMastered = [...prev.masteredIds];
        if (newSuccess[currentQuestion.id] >= MASTERY_THRESHOLD && !newMastered.includes(currentQuestion.id)) {
          newMastered.push(currentQuestion.id);
        }
        return { ...prev, successCounts: newSuccess, masteredIds: newMastered };
      });
      setTimeout(() => nextQuestion(), 800);
    } else {
      setQuiz(prev => ({ ...prev, mistakes: [...prev.mistakes, currentQuestion.id] }));
      setProgress(prev => {
        const newWeak = { ...prev.weakIds };
        newWeak[currentQuestion.id] = (newWeak[currentQuestion.id] || 0) + 1;
        const newSuccess = { ...prev.successCounts };
        newSuccess[currentQuestion.id] = Math.max(0, (newSuccess[currentQuestion.id] || 0) - 1);
        return { ...prev, weakIds: newWeak, successCounts: newSuccess };
      });
      try {
        const aiTip = await getMnemonicForChar(currentQuestion);
        if (aiTip) setMnemonic(aiTip);
        else setIsProcessing(false);
      } catch (err: any) {
        if (err.message?.includes("Requested entity was not found")) {
          setHasKey(false);
          setGlobalError("Please select a valid paid API key.");
        } else {
          setGlobalError("Could not fetch mnemonic tip.");
        }
        setIsProcessing(false);
      }
    }
  };

  const nextQuestion = () => {
    setMnemonic(null);
    setIsProcessing(false);
    if (quiz.currentIndex < quiz.questions.length - 1) {
      setQuiz(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    } else {
      setView('review');
    }
  };

  const resetToHome = () => {
    setView('home');
    setQuiz({ isActive: false, currentIndex: 0, score: 0, questions: [], mistakes: [] });
    setSelectedGrammar(null);
  };

  const getStatus = (charId: string): ProgressStatus => {
    const success = progress.successCounts[charId] || 0;
    if (progress.masteredIds.includes(charId)) return 'Completed';
    if (success > 0) return 'In progress';
    return 'Not started';
  };

  const getProficiency = (charId: string): ProficiencyLevel => {
    const success = progress.successCounts[charId] || 0;
    if (success >= PROFICIENCY_ADVANCED) return 'Advanced';
    if (success >= PROFICIENCY_INTERMEDIATE) return 'Intermediate';
    if (success > 0) return 'Beginner';
    return 'None';
  };

  const HomeView = () => (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-top-4 duration-700 relative">
      {unlockNotification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-500 w-full max-w-xs px-4">
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-emerald-400">
             <div className="text-3xl font-jp">{unlockNotification.char}</div>
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">New Discovery!</p>
               <p className="font-bold text-lg leading-tight">Unlocked: {unlockNotification.romaji || unlockNotification.meaning}</p>
             </div>
             <button onClick={() => setUnlockNotification(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      <header className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-slate-800 mb-4 tracking-tight">
          N5 <span className="text-indigo-600">Japanese</span> Master
        </h1>
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-500 text-lg">Detailed progress and proficiency tracking for N5 learners.</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
               <div className="flex flex-col items-center border-r pr-4 border-slate-100">
                  <span className="text-2xl font-bold text-indigo-600 leading-none">{totalMasteredCount}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Mastered</span>
               </div>
               <div className="flex flex-col items-center pl-2">
                  <span className="text-2xl font-bold text-emerald-600 leading-none">{combinedDiscoveredPool.length}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Available</span>
               </div>
            </div>
            <button 
              onClick={() => setView('progress-overview')}
              className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-bold rounded-full border border-indigo-100 hover:bg-indigo-50 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              View Proficiency
            </button>
          </div>
        </div>
      </header>

      <section className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest mb-4 backdrop-blur-md">Mixed Training</span>
            <h2 className="text-3xl font-extrabold mb-3">Adaptive Challenge</h2>
            <p className="text-indigo-100 text-lg mb-6 opacity-90">Test yourself on everything discovered so far.</p>
            <Button variant="secondary" className="!px-10" onClick={() => startQuiz('general')}>Start Review</Button>
          </div>
        </div>
        
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-purple-100 flex flex-col justify-between">
           <div>
              <h3 className="text-2xl font-extrabold mb-2">Grammar</h3>
              <p className="text-purple-50 text-sm opacity-80">Particles & Sentence structure.</p>
           </div>
           <Button variant="ghost" className="bg-white/10 hover:bg-white/20 text-white" onClick={() => setView('grammar-list')}>View Lessons</Button>
        </div>
      </section>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { id: 'hiragana', title: 'Hiragana', icon: 'あ', color: 'indigo', total: HIRAGANA.length, pool: HIRAGANA },
          { id: 'katakana', title: 'Katakana', icon: 'ア', color: 'blue', total: KATAKANA.length, pool: KATAKANA },
          { id: 'kanji', title: 'N5 Kanji', icon: '日', color: 'rose', total: KANJI_N5.length, pool: KANJI_N5 },
          { id: 'vocabulary', title: 'Vocabulary', icon: '学校', color: 'emerald', total: VOCABULARY_N5.length, pool: VOCABULARY_N5 }
        ].map((item) => {
          const masteredCount = item.pool.filter(c => progress.masteredIds.includes(c.id)).length;
          return (
            <div key={item.id} className="group relative bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:border-indigo-200 hover:-translate-y-2">
              <div className={`text-4xl font-jp mb-4 w-16 h-16 flex items-center justify-center rounded-2xl mx-auto bg-${item.color}-50 text-${item.color}-600 shadow-sm`}>
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-2">{item.title}</h3>
              <div className="text-center mb-6">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                     <div className={`h-full bg-${item.color}-500`} style={{ width: `${(masteredCount / item.total) * 100}%` }} />
                   </div>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                   {masteredCount} / {item.total} Mastered
                 </p>
              </div>
              <div className="space-y-2">
                <Button fullWidth onClick={() => startQuiz(item.id as CharacterType)}>Practice</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ProgressOverview = () => {
    const proficiencyColors = {
      'None': 'bg-slate-50 text-slate-300 border-slate-100',
      'Beginner': 'bg-blue-50 text-blue-600 border-blue-100',
      'Intermediate': 'bg-amber-50 text-amber-600 border-amber-100',
      'Advanced': 'bg-emerald-50 text-emerald-600 border-emerald-100'
    };

    const statusBadges = {
      'Not started': 'bg-slate-100 text-slate-400',
      'In progress': 'bg-amber-100 text-amber-600',
      'Completed': 'bg-emerald-100 text-emerald-600'
    };

    return (
      <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-10">
          <button onClick={resetToHome} className="text-indigo-600 font-bold flex items-center gap-2 mb-4 hover:translate-x-[-4px] transition-transform">
            ← Back to Dashboard
          </button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-extrabold text-slate-800">Mastery Dashboard</h2>
              <p className="text-slate-500 text-lg">Deep dive into your script progress and character proficiency levels.</p>
            </div>
            <div className="flex gap-2">
              {['Beginner', 'Intermediate', 'Advanced'].map(p => (
                <div key={p} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${proficiencyColors[p as keyof typeof proficiencyColors]}`}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="space-y-16">
          {[
            { type: 'Hiragana', pool: HIRAGANA, color: 'indigo', subsections: [
                { name: 'Basics (46)', items: HIRAGANA.slice(0, 46) },
                { name: 'Dakuten & Handakuten (25)', items: HIRAGANA.slice(46) }
            ]},
            { type: 'Katakana', pool: KATAKANA, color: 'blue', subsections: [
                { name: 'Basics (46)', items: KATAKANA.slice(0, 46) }
            ]},
            { type: 'Kanji', pool: KANJI_N5, color: 'rose', subsections: [
                { name: 'Standard N5 Set (110)', items: KANJI_N5 }
            ]}
          ].map((script) => {
            const masteredCount = script.pool.filter(c => getStatus(c.id) === 'Completed').length;
            const inProgressCount = script.pool.filter(c => getStatus(c.id) === 'In progress').length;
            const advancedCount = script.pool.filter(c => getProficiency(c.id) === 'Advanced').length;

            return (
              <section key={script.type} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div className="flex-1">
                    <h3 className="text-3xl font-extrabold text-slate-800 mb-2">{script.type} Mastery</h3>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm font-bold text-slate-600">{masteredCount} Completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-400" />
                        <span className="text-sm font-bold text-slate-600">{inProgressCount} In Progress</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700">{advancedCount} Highly Proficient</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden w-full md:w-64 flex shadow-inner">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(masteredCount / script.pool.length) * 100}%` }} />
                    <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${(inProgressCount / script.pool.length) * 100}%` }} />
                  </div>
                </div>

                {script.subsections.map((sub) => (
                  <div key={sub.name} className="mb-10 last:mb-0">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">{sub.name}</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                      {sub.items.map(c => {
                        const status = getStatus(c.id);
                        const proficiency = getProficiency(c.id);
                        const boxColor = proficiencyColors[proficiency];

                        return (
                          <div 
                            key={c.id} 
                            title={`${c.char} - ${status} (${proficiency})`}
                            className={`
                              aspect-square flex flex-col items-center justify-center rounded-2xl border-2 transition-all group relative cursor-help hover:scale-110 active:scale-90
                              ${boxColor} ${status === 'Not started' ? 'opacity-40 grayscale' : ''}
                            `}
                          >
                            <span className="font-jp text-xl font-bold leading-none">{c.char}</span>
                            
                            {/* Mastery Badge */}
                            <div className="absolute top-1 left-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                               <div className={`px-1 rounded text-[6px] font-bold uppercase ${statusBadges[status]}`}>
                                  {status.replace(' ', '')}
                               </div>
                            </div>

                            {/* Proficiency Indicator Dots */}
                            <div className="absolute bottom-1.5 flex gap-0.5">
                               {[1, 2, 3].map(lvl => (
                                 <div 
                                   key={lvl} 
                                   className={`w-1 h-1 rounded-full ${
                                     (proficiency === 'Beginner' && lvl <= 1) || 
                                     (proficiency === 'Intermediate' && lvl <= 2) || 
                                     (proficiency === 'Advanced' && lvl <= 3)
                                     ? 'bg-current' : 'bg-slate-200'
                                   }`} 
                                 />
                               ))}
                            </div>

                            {status === 'Completed' && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  const VocabularyListView = () => (
    <div className="max-w-5xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={resetToHome} className="text-indigo-600 font-bold flex items-center gap-2 mb-2 hover:translate-x-[-4px] transition-transform">
            ← Back to Dashboard
          </button>
          <h2 className="text-4xl font-extrabold text-slate-800">N5 Vocabulary Library</h2>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full md:w-80 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={vocabSearch}
            onChange={(e) => setVocabSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Japanese</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Meaning</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Look Up</th>
              </tr>
            </thead>
            <tbody>
              {filteredVocab.map(v => (
                <tr key={v.id} className="group border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-jp text-2xl text-indigo-600 font-bold">{v.char}</span>
                      <span className="text-xs text-slate-400 font-medium italic">{v.romaji}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-bold text-slate-700">{v.meaning}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => openDictionary(v.char, v.type)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-2 text-xs font-bold"
                    >
                      Jisho.org
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const GrammarListView = () => (
    <div className="max-w-5xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={resetToHome} className="text-indigo-600 font-bold flex items-center gap-2 mb-2 hover:translate-x-[-4px] transition-transform">
            ← Back to Dashboard
          </button>
          <h2 className="text-4xl font-extrabold text-slate-800">Grammar Lessons</h2>
          <p className="text-slate-500 mt-1">Foundation patterns for N5 proficiency.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search patterns..." 
            className="w-full md:w-80 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
            value={grammarSearch}
            onChange={(e) => setGrammarSearch(e.target.value)}
          />
        </div>
      </header>

      {selectedGrammar ? (
        <div className="animate-in zoom-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-purple-100 max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                 <span className="px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold tracking-widest uppercase">N5 Lesson</span>
                 <button onClick={() => setSelectedGrammar(null)} className="text-slate-300 hover:text-slate-500">✕ Close</button>
              </div>
              
              <h3 className="text-3xl font-extrabold text-slate-800 mb-2">{selectedGrammar.title}</h3>
              <div className="bg-slate-50 p-4 rounded-2xl mb-8 border border-slate-100">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Structure</p>
                 <p className="text-xl font-bold text-indigo-600 font-jp">{selectedGrammar.structure}</p>
              </div>

              <div className="space-y-6">
                 <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Explanation</h4>
                    <p className="text-slate-700 leading-relaxed text-lg">{selectedGrammar.explanation}</p>
                 </div>

                 <div className="pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Example Sentence</h4>
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                       <p className="text-2xl font-jp font-bold text-indigo-900 mb-2">{selectedGrammar.example_jp}</p>
                       <p className="text-slate-600 italic">{selectedGrammar.example_en}</p>
                    </div>
                 </div>
              </div>

              <div className="mt-10 flex gap-4">
                 <Button fullWidth onClick={() => setSelectedGrammar(null)}>Back to List</Button>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGrammar.map(g => (
            <button 
              key={g.id}
              onClick={() => setSelectedGrammar(g)}
              className="bg-white p-6 rounded-3xl text-left border border-slate-100 shadow-lg shadow-slate-200/50 hover:border-purple-300 hover:-translate-y-1 transition-all"
            >
              <h4 className="text-xl font-extrabold text-slate-800 mb-1">{g.title}</h4>
              <p className="text-slate-500 text-sm line-clamp-2">{g.explanation}</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-purple-600">
                 View Breakdown
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                 </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const QuizView = () => {
    if (!currentQuestion) return null;
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-8">
          <button onClick={resetToHome} className="text-slate-400 font-bold hover:text-slate-600 transition-colors">✕ Quit</button>
          <div className="flex flex-col items-end">
            <span className="font-bold text-slate-700">{quiz.currentIndex + 1} / {quiz.questions.length}</span>
          </div>
        </div>
        
        <QuizCard 
          character={currentQuestion}
          options={options}
          onAnswer={handleAnswer}
          isProcessing={isProcessing}
        />

        {mnemonic && (
          <div className="w-full max-w-md">
            <MnemonicDisplay 
              mnemonic={mnemonic} 
              onClose={() => setMnemonic(null)} 
            />
            <div className="mt-4 flex gap-2">
              <Button fullWidth variant="primary" onClick={nextQuestion}>Next Question</Button>
              <button 
                onClick={() => openDictionary(currentQuestion.char, currentQuestion.type)}
                className="px-4 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50"
              >
                Jisho
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ReviewView = () => (
    <div className="max-w-2xl mx-auto py-12 px-6 text-center animate-in zoom-in duration-500">
      <h2 className="text-4xl font-extrabold text-slate-800 mb-2">Session Complete!</h2>
      <p className="text-slate-500 text-lg mb-8">Score: <span className="text-indigo-600 font-bold">{quiz.score}/{quiz.questions.length}</span></p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button variant="primary" onClick={() => startQuiz(activeType)}>Retry</Button>
        <Button variant="ghost" onClick={resetToHome}>Back to Home</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="p-6 bg-white/50 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetToHome}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200">日</div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">Sensei AI</span>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Mastered</p>
            <p className="font-bold text-indigo-600 leading-none">{totalMasteredCount}</p>
          </div>
        </div>
      </nav>
      <main>
        {view === 'home' && <HomeView />}
        {view === 'quiz' && <QuizView />}
        {view === 'review' && <ReviewView />}
        {view === 'vocab-list' && <VocabularyListView />}
        {view === 'grammar-list' && <GrammarListView />}
        {view === 'progress-overview' && <ProgressOverview />}
      </main>
      {globalError && (
        <div className="fixed bottom-6 right-6 bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)}>✕</button>
        </div>
      )}
    </div>
  );
};

export default App;
