import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { PriceTier, RecFeedback, RecRequest, RecResult, Suggestion } from './types';

/**
 * The current "generate → pick one" round. Persisted to sessionStorage so a
 * refresh on the results page doesn't lose your suggestions.
 */
interface RecSession {
  request: RecRequest | null;
  suggestions: Suggestion[];
  shownIds: string[];
  exhausted: boolean;
  budget: PriceTier | null;
  round: number;
}

interface RecSessionApi extends RecSession {
  loading: boolean;
  error: string | null;
  generate: (req: RecRequest) => Promise<boolean>;
  regenerate: (feedback?: RecFeedback) => Promise<boolean>;
  clear: () => void;
}

const KEY = 'outbound.recSession';
const empty: RecSession = { request: null, suggestions: [], shownIds: [], exhausted: false, budget: null, round: 0 };

const Ctx = createContext<RecSessionApi | null>(null);

export function RecSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecSession>(() => {
    try {
      return { ...empty, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') };
    } catch {
      return empty;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const run = useCallback(async (req: RecRequest, shownBefore: string[], round: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<RecResult>('/recommendations', { body: { ...req, excludeIds: shownBefore } });
      setState({
        request: req,
        suggestions: res.suggestions,
        shownIds: [...shownBefore, ...res.suggestions.map((s) => s.place.id)],
        exhausted: res.exhausted,
        budget: res.budget,
        round,
      });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = useCallback((req: RecRequest) => run({ ...req, feedback: undefined }, [], 1), [run]);

  const regenerate = useCallback(
    (feedback?: RecFeedback) => {
      if (!state.request) return Promise.resolve(false);
      return run({ ...state.request, feedback }, state.shownIds, state.round + 1);
    },
    [run, state.request, state.shownIds, state.round],
  );

  const clear = useCallback(() => setState(empty), []);

  return <Ctx.Provider value={{ ...state, loading, error, generate, regenerate, clear }}>{children}</Ctx.Provider>;
}

export function useRecSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRecSession must be used inside RecSessionProvider');
  return ctx;
}
