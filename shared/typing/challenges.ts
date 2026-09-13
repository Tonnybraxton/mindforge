import { seededRandom } from '../games/random';
import type { TypingConfig } from './types';

export const storyChapters = [
  { title: 'The river gate', story: 'Mira reaches a locked gate below the silent lighthouse. A weathered brass plate carries the words that open it.', text: 'Follow the silver river. Keep the lantern bright. The gate opens for a patient traveler.' },
  { title: 'A message in the reeds', story: 'Beyond the gate, a signal strip lies tangled in the reeds. Copy its message to recover the route to the bridge.', text: 'At the bridge, turn toward the cedar tree. Three pale stones mark the path. Carry the blue crystal to the tower.' },
  { title: 'The paper sentry', story: 'An enchanted paper sentry blocks the tower stairs. Reconstruct its forgotten promise to persuade it to stand aside.', text: 'I guard this place for every kind traveler. A clear purpose opens the way. Welcome, keeper of the blue crystal.' },
  { title: 'Repair the lens', story: 'The beacon lens is out of alignment. Enter the original maintenance instructions, including every bracket and number.', text: 'Set lens[0] = 12; set lens[1] = 24; align("blue"); check_signal(); confirm: all mirrors are clear.' },
  { title: 'The quiet beacon', story: 'The lens is ready. Send the final message to restore the light and guide the boats home.', text: 'Cedar Bay, this is the northern beacon. The channel is clear, the lantern is steady, and the harbor is waiting. Welcome home.' },
];
export function typingQuestion(config: TypingConfig): { prompt: string; answer: string } {
  const random = seededRandom(`typing-question:v1:${config.seed}`);
  const choose = <T,>(rows: T[]) => rows[Math.floor(random() * rows.length)];
  if (config.mode === 'completion') return choose([
    { prompt: 'Complete the arrow function: const double = n ___ n * 2;', answer: '=>' },
    { prompt: 'Complete the function body: function add(a, b) ___', answer: '{\n    return a + b;\n}' },
    { prompt: 'Choose strict equality: if (answer ___ expected) { finish(); }', answer: '===' },
    { prompt: 'Which keyword waits for a promise? const data = ___ response.json();', answer: 'await' },
    { prompt: 'Which keyword makes this function asynchronous? ___ function load() { return 1; }', answer: 'async' },
    { prompt: 'Complete the SQL query: ___ name FROM fictional_products;', answer: 'SELECT' },
    { prompt: 'Close the semantic HTML element: <section><h2>Practice</h2>___', answer: '</section>' },
  ]);
  const left = 10 + Math.floor(random() * 80), right = 2 + Math.floor(random() * 12);
  return choose([
    { prompt: `Mental math: type the answer to ${left} + ${right}.`, answer: String(left + right) },
    { prompt: `Pattern: ${right}, ${right * 2}, ${right * 3}, __. Type the next number.`, answer: String(right * 4) },
    { prompt: 'Missing word: Accuracy comes before ___.', answer: 'speed' },
    { prompt: 'Sudoku notation: type the coordinate for row 4, column 7, followed by the value 3. Use r4c7=3 format.', answer: 'r4c7=3' },
    { prompt: 'Reverse the sequence 4 8 2 9. Type the digits without spaces.', answer: '9284' },
  ]);
}
