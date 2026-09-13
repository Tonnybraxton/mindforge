import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, Flag, RotateCcw, Undo2 } from 'lucide-react';
import { inkColors, type GameAction, type GameState, type PatternTile as Tile, type SequenceState, type SudokuState } from '../../shared/games/engine';
import type { Direction } from '../../shared/games/sokoban';
import { Button } from './ui';

export interface BoardProps { state: GameState; dispatch: (action: GameAction) => void; active: boolean; }
const symbols = ['☀', '☾', '★', '♥', '◆', '♣', '♠', '✿', '⚑', '♫', '☁', '☂', '☕', '⚓', '✈', '⌛', '⚙', '✦', '♜', '♞', '⚡', '❄', '✉', '☯'];
const symbolNames = ['sun', 'moon', 'star', 'heart', 'diamond', 'club', 'spade', 'flower', 'flag', 'music', 'cloud', 'umbrella', 'cup', 'anchor', 'plane', 'hourglass', 'gear', 'sparkle', 'castle', 'knight', 'lightning', 'snowflake', 'envelope', 'yin yang'];
const columns = (count: number): CSSProperties => ({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` });
const directionKeys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', a: 'left', s: 'down', d: 'right' };

function SequenceBoard({ state, dispatch, active }: Omit<BoardProps, 'state'> & { state: SequenceState }) {
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const { phase, round, sequences, difficulty } = state;
  useEffect(() => {
    setLit(null); setStep(0);
    if (!active || phase !== 'preview') return;
    const sequence = sequences[round];
    const pace = Math.max(450, 1000 - difficulty * 55);
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((tile, index) => {
      timers.push(setTimeout(() => { setLit(tile); setStep(index + 1); }, 600 + index * pace));
      timers.push(setTimeout(() => setLit(null), 600 + index * pace + pace * 0.65));
    });
    timers.push(setTimeout(() => dispatch({ type: 'preview-end' }), 600 + sequence.length * pace));
    return () => timers.forEach(clearTimeout);
  }, [active, phase, round, sequences, difficulty, dispatch, state.metrics.mistakes]);
  return <div className="game-board"><p className="board-instruction" aria-live="polite">{phase === 'preview' ? `Watch the sequence${active && step ? ` · ${step} of ${sequences[round].length}` : ''}` : `Your turn · ${state.cursor} of ${sequences[round].length} tiles recalled`}</p><div className="sequence-grid" style={columns(Math.sqrt(state.gridSize))}>{Array.from({ length: state.gridSize }, (_, index) => <button key={index} className={`sequence-tile ${lit === index ? 'lit' : ''}`} aria-label={`Tile ${index + 1}${lit === index ? ', lit' : ''}`} aria-pressed={lit === index} disabled={!active || phase === 'preview'} onClick={() => dispatch({ type: 'tap', index })}>{index + 1}</button>)}</div><p className="board-instruction">Round {round + 1} of {sequences.length} · {3 - state.metrics.mistakes} {state.metrics.mistakes === 2 ? 'chance' : 'chances'} left</p></div>;
}

function SudokuBoard({ state, dispatch, active }: Omit<BoardProps, 'state'> & { state: SudokuState }) {
  const [selected, setSelected] = useState(() => state.givens.findIndex(value => !value));
  const grid = useRef<HTMLDivElement>(null);
  const select = (index: number) => { setSelected(index); grid.current?.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`)?.focus(); };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    let next = selected;
    if (event.key === 'ArrowLeft') next = Math.max(0, selected - 1);
    else if (event.key === 'ArrowRight') next = Math.min(state.cells.length - 1, selected + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, selected - state.size);
    else if (event.key === 'ArrowDown') next = Math.min(state.cells.length - 1, selected + state.size);
    else if (/^[1-9]$/.test(event.key)) dispatch({ type: 'set', index: selected, value: Number(event.key) });
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') dispatch({ type: 'set', index: selected, value: 0 });
    else return;
    event.preventDefault(); if (next !== selected) select(next);
  };
  return <div className="game-board" onKeyDown={keyDown}><p className="board-instruction">Choose a cell, then enter a number from 1 to {state.size}.</p><div ref={grid} className="sudoku-grid" style={columns(state.size)} role="group" aria-label={`${state.size} by ${state.size} Sudoku puzzle`}>{state.cells.map((value, index) => {
    const row = Math.floor(index / state.size), col = index % state.size;
    const incorrect = value > 0 && value !== state.solution[index];
    return <button key={index} data-cell={index} tabIndex={selected === index ? 0 : -1} disabled={!active} aria-label={`Row ${row + 1}, column ${col + 1}, ${value || 'empty'}${state.givens[index] ? ', fixed clue' : incorrect ? ', incorrect' : ''}`} aria-pressed={selected === index} aria-invalid={incorrect} className={`sudoku-cell ${state.givens[index] ? 'given' : ''} ${selected === index ? 'selected' : ''} ${incorrect ? 'incorrect' : ''}`} style={{ borderRightWidth: (col + 1) % state.boxCols === 0 && col + 1 < state.size ? 3 : 1, borderBottomWidth: (row + 1) % state.boxRows === 0 && row + 1 < state.size ? 3 : 1 }} onClick={() => setSelected(index)}>{value || ''}</button>;
  })}</div><div className="number-pad" aria-label="Enter number">{Array.from({ length: state.size }, (_, index) => <Button variant="secondary" key={index} disabled={!active || !!state.givens[selected]} onClick={() => dispatch({ type: 'set', index: selected, value: index + 1 })}>{index + 1}</Button>)}<Button variant="ghost" disabled={!active || !!state.givens[selected]} onClick={() => dispatch({ type: 'set', index: selected, value: 0 })}>Clear</Button></div><p className="board-instruction">Arrow keys move between cells. Backspace clears a number.</p></div>;
}

export function DirectionPad({ onMove, disabled }: { onMove: (direction: Direction) => void; disabled: boolean }) {
  return <div className="direction-pad" aria-label="Movement controls">{[{ direction: 'up', Icon: ArrowUp }, { direction: 'left', Icon: ArrowLeft }, { direction: 'down', Icon: ArrowDown }, { direction: 'right', Icon: ArrowRight }].map(({ direction, Icon }) => <Button key={direction} variant="secondary" className={`direction-${direction}`} disabled={disabled} aria-label={`Move ${direction}`} onClick={() => onMove(direction as Direction)}><Icon size={22}/></Button>)}</div>;
}

export function PatternTile({ tile }: { tile: Tile }) {
  const shapes = ['circle', 'square', 'diamond', 'hexagon'];
  const label = `${tile.dots} ${tile.dots === 1 ? 'dot' : 'dots'}, ${shapes[tile.shape]}, pointer ${['up', 'right', 'down', 'left'][tile.rotation]}`;
  const dots = tile.dots === 1 ? [[50, 52]] : tile.dots === 2 ? [[39, 52], [61, 52]] : tile.dots === 3 ? [[50, 41], [39, 62], [61, 62]] : [[39, 41], [61, 41], [39, 62], [61, 62]];
  return <svg className="pattern-tile" viewBox="0 0 100 100" role="img" aria-label={label}><g fill="none" stroke="currentColor" strokeWidth="3">{tile.shape === 0 ? <circle cx="50" cy="50" r="38"/> : tile.shape === 1 ? <rect x="13" y="13" width="74" height="74" rx="8"/> : tile.shape === 2 ? <path d="M50 6 94 50 50 94 6 50Z"/> : <path d="M28 12H72L94 50 72 88H28L6 50Z"/>}</g><path fill="currentColor" d="M50 15 44 25H56Z" transform={`rotate(${tile.rotation * 90} 50 50)`}/>{dots.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="5" fill="currentColor"/>)}</svg>;
}

export default function GameBoard({ state, dispatch, active }: BoardProps) {
  const [answer, setAnswer] = useState('');
  useEffect(() => {
    if (!active || state.slug !== 'memory-cards' || state.flipped.length !== 2) return;
    const timer = setTimeout(() => dispatch({ type: 'hide' }), 950);
    return () => clearTimeout(timer);
  }, [state, active, dispatch]);
  if (state.slug === 'sequence-recall') return <SequenceBoard state={state} dispatch={dispatch} active={active}/>;
  if (state.slug === 'sudoku') return <SudokuBoard state={state} dispatch={dispatch} active={active}/>;
  if (state.slug === 'memory-cards') return <div className="game-board"><p className="board-instruction" aria-live="polite">{state.matched.length / 2} of {state.deck.length / 2} pairs found{state.flipped.length === 2 ? ' · Keep those two in mind' : state.flipped.length === 1 ? ' · Find its match' : ''}</p><div className="memory-grid" style={columns(state.deck.length <= 4 ? 2 : state.deck.length <= 16 ? 4 : 6)}>{state.deck.map((symbol, index) => {
    const matched = state.matched.includes(index), revealed = matched || state.flipped.includes(index);
    return <button key={index} className={`memory-card ${revealed ? 'revealed' : ''} ${matched ? 'matched' : ''}`} disabled={!active || matched || state.flipped.length === 2 || state.flipped.includes(index)} aria-label={`Card ${index + 1}, ${revealed ? symbolNames[symbol] : 'face down'}${matched ? ', matched' : ''}`} onClick={() => dispatch({ type: 'flip', index })}><span aria-hidden="true">{revealed ? symbols[symbol] : '✦'}</span></button>;
  })}</div></div>;
  if (state.slug === 'mental-math') return <div className="game-board"><p className="board-instruction">Calculation {state.question + 1} of {state.questions.length}</p><div className="math-prompt" aria-live="polite">{state.questions[state.question].prompt} <span>= ?</span></div><form className="answer-form" onSubmit={event => { event.preventDefault(); if (answer.trim() && /^-?\d+$/.test(answer.trim())) { dispatch({ type: 'answer', value: Number(answer) }); setAnswer(''); } }}><label className="sr-only" htmlFor="math-answer">Your answer</label><input id="math-answer" inputMode="numeric" autoComplete="off" placeholder="Your answer" value={answer} disabled={!active} onChange={event => setAnswer(event.target.value)}/><Button disabled={!active || !/^-?\d+$/.test(answer.trim())} type="submit">Check answer <ArrowRight size={17}/></Button></form><p className={`feedback ${state.feedback?.correct ? 'success' : 'error'}`} aria-live="polite">{state.feedback ? state.feedback.correct ? 'Correct. Keep going!' : `The previous answer was ${state.feedback.answer}. Try this one.` : 'Take a breath. You have got this.'}</p></div>;
  if (state.slug === 'maze-runner' || state.slug === 'sokoban') {
    const isCrates = state.slug === 'sokoban';
    const move = (direction: Direction) => dispatch({ type: 'move', value: direction });
    return <div className="game-board spatial-board" tabIndex={active ? 0 : -1} role="group" aria-label={`${isCrates ? 'Sokoban' : 'Maze'} board. Use arrow keys or W A S D to move.`} onKeyDown={event => { const direction = directionKeys[event.key]; if (active && direction && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); move(direction); } }}><p className="board-instruction" aria-live="polite">{isCrates ? `${state.boxes.filter(box => state.targets.includes(box)).length} of ${state.boxes.length} crates on target` : 'Follow the corridors to the flag.'}</p><div className="spatial-grid" style={columns(state.width)} aria-label={`Player row ${Math.floor(state.player / state.width) + 1}, column ${state.player % state.width + 1}`}>{Array.from({ length: state.width * state.height }, (_, index) => {
      const wall = state.walls.includes(index), player = state.player === index, target = isCrates && state.targets.includes(index), crate = isCrates && state.boxes.includes(index), exit = !isCrates && state.exit === index;
      return <div key={index} className={`spatial-cell ${wall ? 'wall' : ''} ${player ? 'player' : ''} ${target ? 'target' : ''} ${crate ? 'crate' : ''} ${!isCrates && state.trail.includes(index) ? 'trail' : ''}`} aria-label={wall ? undefined : `Row ${Math.floor(index / state.width) + 1}, column ${index % state.width + 1}${player ? ', player' : ''}${crate ? ', crate' : ''}${target ? ', target' : ''}${exit ? ', exit' : ''}`}>{player ? <span aria-hidden="true">●</span> : crate ? <Box size={23} aria-hidden="true"/> : exit ? <Flag size={23} aria-hidden="true"/> : target ? <span aria-hidden="true">○</span> : ''}</div>;
    })}</div><DirectionPad onMove={move} disabled={!active}/>{isCrates && <div className="button-row"><Button variant="secondary" disabled={!active || !state.history.length} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={16}/> Undo</Button><Button variant="ghost" disabled={!active} onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={16}/> Reset board</Button></div>}<p className="board-instruction">Use the buttons, or focus the board and use arrow keys.</p></div>;
  }
  if (state.slug === 'stroop-challenge') {
    const question = state.questions[state.question];
    return <div className="game-board" onKeyDown={event => { if (active && /^[1-6]$/.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); dispatch({ type: 'answer', index: Number(event.key) - 1 }); } }}><p className="board-instruction">Choose the ink color · Round {state.question + 1} of {state.questions.length}</p><div className="stroop-word" style={{ color: inkColors[question.ink].hex }} aria-label={`Word ${inkColors[question.word].name}, ink ${inkColors[question.ink].name}`} aria-live="polite">{inkColors[question.word].name.toUpperCase()}</div><div className="color-options">{inkColors.slice(0, state.colorCount).map((color, index) => <Button key={color.name} variant="secondary" disabled={!active} style={{ borderColor: color.hex }} onClick={() => dispatch({ type: 'answer', index })}><span className="color-dot" style={{ backgroundColor: color.hex }}/>{color.name}<kbd>{index + 1}</kbd></Button>)}</div><p aria-live="polite" className={`feedback ${state.feedback ? 'success' : 'error'}`}>{state.feedback === null ? 'Trust the color you see.' : state.feedback ? 'Correct!' : 'That was the word. Look at the ink.'}</p></div>;
  }
  const question = state.questions[state.question];
  return <div className="game-board"><p className="board-instruction">Find the missing tile · Matrix {state.question + 1} of {state.questions.length}</p><div className="pattern-grid">{question.tiles.map((tile, index) => <div key={index}><PatternTile tile={tile}/></div>)}<div className="pattern-missing" aria-label="Missing bottom-right tile">?</div></div><div className="pattern-options" aria-label="Answer options">{question.options.map((tile, index) => <button key={index} className={state.rejected.includes(index) ? 'rejected' : ''} disabled={!active || state.rejected.includes(index)} aria-label={`Option ${index + 1}${state.rejected.includes(index) ? ', incorrect' : ''}`} onClick={() => dispatch({ type: 'answer', index })}><PatternTile tile={tile}/><span>{index + 1}{state.rejected.includes(index) ? ' ×' : ''}</span></button>)}</div><p className="feedback" aria-live="polite">{state.rejected.length ? 'That tile does not follow the pattern. Look along the rows and columns.' : 'Look for a change that repeats in both directions.'}</p></div>;
}
