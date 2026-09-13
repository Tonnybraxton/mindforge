import { useState } from 'react';
import { baseKeyFor, fingerForKey, keyboardRows, shiftForKey } from '../../../shared/typing/content';
import type { MasteryRow } from '../../../shared/typing/analytics';
export function Keyboard({ expected = '', pressed = '', incorrect = false, stats = [], heatmap = false, onPractice }: { expected?: string; pressed?: string; incorrect?: boolean; stats?: MasteryRow[]; heatmap?: boolean; onPractice?: (key: string) => void }) {
  const [filter, setFilter] = useState('mastery');
  const [selected, setSelected] = useState('');
  const detail = stats.find(k => k.key === selected), expectedBase = baseKeyFor(expected);
  const finger = fingerForKey(expected), shift = shiftForKey(expected);
  return <div className="typing-keyboard-wrap">
    {heatmap && <div className="typing-section-label"><div><h2>Your keyboard, understood.</h2><p>Select a key to inspect your own practice data.</p></div><select aria-label="Heatmap metric" value={filter} onChange={e => setFilter(e.target.value)}><option value="mastery">Mastery</option><option value="accuracy">Accuracy</option><option value="speed">Speed / reaction</option><option value="errors">Mistakes</option></select></div>}
    <div className="typing-keyboard" role="group" aria-label={heatmap ? 'Keyboard mastery heatmap' : 'QWERTY finger guide'}>
      {keyboardRows.map((row, i) => <div className={`keyboard-row keyboard-row-${i}`} key={i}>{row.split('').map(key => {
        const stat = stats.find(k => k.key === key), score = stat ? filter === 'accuracy' ? stat.accuracy : filter === 'errors' ? 100 - Math.min(100, stat.incorrect * 10) : filter === 'speed' ? Math.max(0, 100 - stat.averageLatency / 10) : stat.mastery : 0;
        return <button type="button" className={`typing-key ${key === ' ' ? 'space-key' : ''} ${expectedBase === key && !heatmap ? 'expected-key' : ''} ${baseKeyFor(pressed) === key && pressed ? incorrect ? 'wrong-key' : 'pressed-key' : ''} ${selected === key ? 'selected-key' : ''} ${heatmap && stat ? score > 80 ? 'mastered-key' : score > 50 ? 'growing-key' : 'weak-key' : ''}`} key={key} aria-label={`${key === ' ' ? 'Space' : key.toUpperCase()}, ${fingerForKey(key)}${stat ? `, ${stat.accuracy}% accuracy, ${stat.attempts} attempts` : ', not practiced yet'}`} onClick={() => setSelected(key)}><strong>{key === ' ' ? 'SPACE' : key.toUpperCase()}</strong>{heatmap && stat && <small>{filter === 'errors' ? stat.incorrect : filter === 'speed' ? `${stat.averageLatency}ms` : `${Math.round(score)}%`}</small>}{!heatmap && ['f', 'j'].includes(key) && <span className="key-bump"/>}</button>;
      })}</div>)}
    </div>
    {!heatmap && <div className="finger-guide"><span className="finger-hand" aria-hidden="true">{['Left pinky', 'Left ring', 'Left middle', 'Left index', 'Thumbs', 'Right index', 'Right middle', 'Right ring', 'Right pinky'].map((f, i) => <i key={f} className={finger === f && expected ? 'active-finger' : ''} style={{ height: `${22 + [0, 10, 17, 9, -7, 9, 17, 10, 0][i]}px` }}/>)}</span><p>{expected ? <>Next: <strong>{expected === ' ' ? 'Space' : expected === '\n' ? 'Enter' : expected === '\t' ? 'Tab' : expected}</strong> · {finger}{shift && ` + ${shift}`}</> : 'Rest on A S D F and J K L ;. Thumbs rest near Space.'}</p></div>}
    {heatmap && selected && <div className="key-detail"><strong>{selected === ' ' ? 'Space' : selected.toUpperCase()} · {fingerForKey(selected)}</strong><p>{detail ? `${detail.accuracy}% accuracy · ${detail.attempts} attempts · ${detail.incorrect} mistakes · ${detail.averageLatency} ms average transition · ${detail.mastery}% mastery` : 'No practice data yet. A key needs 20 attempts before it can reach full mastery.'}</p>{onPractice && <button className="text-link" onClick={() => onPractice(selected)}>Practice this key →</button>}</div>}
  </div>;
}
