import { useMemo } from 'react';
import { getLocales } from 'expo-localization';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { ru } from './locales/ru';

export type Lang = 'fr' | 'en' | 'ru';
const DICTS = { fr, en, ru } as const;

/** French by default: the product is about the French system. */
export function deviceLang(): Lang {
  const tag = getLocales()[0]?.languageCode ?? 'fr';
  return tag === 'ru' ? 'ru' : tag === 'en' ? 'en' : 'fr';
}

type Vars = Record<string, string | number>;

function resolve(dict: unknown, key: string): string {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return key;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : key;
}

export function makeT(lang: Lang) {
  const dict = DICTS[lang];
  return (key: string, vars?: Vars) => {
    let out = resolve(dict, key);
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}

export const useT = (lang: Lang = deviceLang()) => useMemo(() => makeT(lang), [lang]);
