import type { ControllerState } from '../app/state';
import { chordForDegree, romanNumeral, type Degree, type Key } from '../music/theory';
import type { Song } from '../songs/types';
import { gelName, gelVar } from './gel';
import { chordNameEs, keyNameEs, signFor } from './labels';

export type ModeKind = 'free' | 'guided' | 'auto';
export interface ViewCtx { mode: ModeKind; key: Key; song: Song | null }

export interface ChordView { degree: Degree; symbol: string; numeral: string; name: string; context: string; gel: string }
export interface StepView { degree: Degree; symbol: string; numeral: string; name: string; emoji: string; signName: string; gel: string }
export interface GuidedView {
  title: string; artist: string; stepText: string; now: StepView | null; next: StepView | null;
  feedback: string; hint: string | null; done: boolean;
}
export interface AutoRow { degree: Degree; symbol: string; numeral: string; name: string; gel: string; current: boolean }
export interface AutoView { title: string; artist: string; summary: string; rows: AutoRow[] }

export interface View {
  chord: ChordView | null;
  /** Prompt shown where the chord would be. Empty while a chord sounds. */
  status: string;
  /** Text for the aria-live region. */
  announcement: string;
  /** Text alternative for the washed video. */
  washLabel: string;
  meters: { volume: number; brightness: number };
  guided?: GuidedView;
  auto?: AutoView;
}

const pct = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 100);

function stepView(key: Key, d: Degree): StepView {
  const chord = chordForDegree(key, d);
  const sign = signFor(d);
  return {
    degree: d, symbol: chord.label, numeral: romanNumeral(key, d), name: chordNameEs(chord),
    emoji: sign.emoji, signName: sign.name, gel: gelVar(d),
  };
}

function guidedView(s: ControllerState, song: Song): GuidedView {
  const g = s.guided ?? { index: 0, lastResult: 'wait' as const, done: false, needsRearticulate: false };
  const total = song.steps.length;
  const nowStep = g.done ? undefined : song.steps[g.index];
  const nextStep = g.done ? undefined : song.steps[g.index + 1];
  const now = nowStep ? stepView(song.key, nowStep.degree) : null;
  const cue = now ? `${now.emoji} ${now.signName}` : '';
  let feedback: string;
  if (g.done) feedback = `¡Terminaste ${song.title}!`;
  else if (g.lastResult === 'hit') feedback = `¡Bien! Ahora ${cue}`;
  else feedback = `Haz la seña ${cue}`;
  return {
    title: `Acordes de ${song.title}`,
    artist: song.artist,
    stepText: `Paso ${Math.min(g.index + 1, total)} de ${total}`,
    now,
    next: nextStep ? stepView(song.key, nextStep.degree) : null,
    feedback,
    hint: g.needsRearticulate ? 'Baja la mano y repite la seña' : null,
    done: g.done,
  };
}

function autoView(s: ControllerState, song: Song): AutoView {
  const seen: Degree[] = [];
  for (const st of song.steps) if (!seen.includes(st.degree)) seen.push(st.degree);
  const rows = seen.map((d) => {
    const v = stepView(song.key, d);
    return { degree: d, symbol: v.symbol, numeral: v.numeral, name: v.name, gel: v.gel, current: s.chord?.degree === d };
  });
  return { title: `Acordes de ${song.title}`, artist: song.artist, summary: rows.map((r) => r.numeral).join(' – '), rows };
}

export function toView(s: ControllerState, ctx: ViewCtx): View {
  const key = ctx.mode !== 'free' && ctx.song ? ctx.song.key : ctx.key;
  const c = s.chord;
  const chord: ChordView | null = c
    ? {
        degree: c.degree, symbol: c.label, numeral: romanNumeral(key, c.degree), name: chordNameEs(c),
        context: `${chordNameEs(c)} · tono ${keyNameEs(key)}`, gel: gelVar(c.degree),
      }
    : null;
  const anyHand = s.handsVisible.chord || s.handsVisible.expression;
  let status = '';
  if (!chord && ctx.mode !== 'auto') status = anyHand ? 'Haz una seña con la mano derecha' : 'Esperando tus manos…';
  const view: View = {
    chord,
    status,
    announcement: chord ? `Suena ${chord.name}, grado ${chord.numeral}` : '',
    washLabel: chord
      ? `Vista de la cámara en espejo, bañada en luz ${gelName(chord.degree)}`
      : 'Vista de la cámara en espejo',
    meters: { volume: pct(s.expression.volume), brightness: pct(s.expression.brightness) },
  };
  if (ctx.mode === 'guided' && ctx.song) view.guided = guidedView(s, ctx.song);
  if (ctx.mode === 'auto' && ctx.song) view.auto = autoView(s, ctx.song);
  return view;
}
