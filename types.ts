
export type CharacterType = 'hiragana' | 'katakana' | 'kanji' | 'vocabulary' | 'general' | 'grammar';

export type ProgressStatus = 'Not started' | 'In progress' | 'Completed';
export type ProficiencyLevel = 'None' | 'Beginner' | 'Intermediate' | 'Advanced';

export interface JapaneseChar {
  id: string;
  char: string;
  romaji: string;
  meaning?: string;
  type: CharacterType;
  kunyomi?: string;
  onyomi?: string;
  sinoVietnamese?: string;
  exampleVocab?: string;
}

export interface GrammarPoint {
  id: string;
  title: string;
  structure: string;
  explanation: string;
  example_jp: string;
  example_en: string;
}

export interface QuizState {
  isActive: boolean;
  currentIndex: number;
  score: number;
  questions: JapaneseChar[];
  mistakes: string[]; // List of IDs
}

export interface UserProgress {
  masteredIds: string[]; // Items successfully answered 3+ times
  weakIds: Record<string, number>; // ID -> frequency of mistakes
  successCounts: Record<string, number>; // ID -> total successful identifications
}

export interface MnemonicResponse {
  character: string;
  mnemonic: string;
  exampleSentence: string;
  translation: string;
}
