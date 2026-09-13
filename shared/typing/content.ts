import type { GameResult } from '../contracts';
import { seededRandom } from '../games/random';
import { defaultTypingConfig, type TypingConfig, type TypingLesson, type TypingRegion } from './types';
import { storyChapters, typingQuestion } from './challenges';

const lessonRows = [
  ['Find the bumps', 'fj', 'Home row'], ['Middle fingers', 'dk', 'Home row'], ['Ring fingers', 'sl', 'Home row'], ['Pinky anchors', 'a;', 'Home row'], ['Index reach', 'gh', 'Home row'], ['Home row flow', 'asdfghjkl;', 'Home row'],
  ['Reach R and U', 'ru', 'Top row'], ['Reach E and I', 'ei', 'Top row'], ['Reach W and O', 'wo', 'Top row'], ['Reach Q and P', 'qp', 'Top row'], ['Reach T and Y', 'ty', 'Top row'], ['Top row flow', 'qwertyuiop', 'Top row'],
  ['Reach V and M', 'vm', 'Bottom row'], ['C and comma', 'c,', 'Bottom row'], ['X and period', 'x.', 'Bottom row'], ['Z and slash', 'z/', 'Bottom row'], ['Reach B and N', 'bn', 'Bottom row'], ['Bottom row flow', 'zxcvbnm,./', 'Bottom row'],
  ['The full alphabet', 'abcdefghijklmnopqrstuvwxyz', 'Whole keyboard'], ['Capital confidence', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Shift'], ['Number row', '1234567890', 'Numbers'], ['Punctuation rhythm', '.,;:!?', 'Punctuation'], ['Brackets and braces', '[]{}()', 'Symbols'], ['Quotes and slashes', "'\"/\\", 'Symbols'], ['Developer symbols', '!@#$%^&*_-+=<>|`~', 'Symbols'], ['Keyboard mastery', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,.!?', 'Whole keyboard'],
];
export const typingLessons: TypingLesson[] = lessonRows.map(([name, keys, stage], index) => ({ id: `lesson-${index + 1}`, name, keys, stage, order: index + 1, minAccuracy: 90, description: `Practice ${keys.toUpperCase().split('').join(' ')} with relaxed hands. Accuracy comes before speed.` }));
export const keyboardRows = ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./', ' '];
const shifted = '~!@#$%^&*()_+{}|:"<>?';
const unshifted = '`1234567890-=[]\\;\',./';
export function baseKeyFor(key: string) { if (!key) return ''; const index = shifted.indexOf(key); return index >= 0 ? unshifted[index] : key.toLowerCase(); }
export function fingerForKey(key: string): string {
  const k = baseKeyFor(key);
  if (k === ' ') return 'Thumbs';
  const groups: [string, string][] = [['`1qaz', 'Left pinky'], ['2wsx', 'Left ring'], ['3edc', 'Left middle'], ['45rtfgvb', 'Left index'], ['67yuhjnm', 'Right index'], ['8ik,', 'Right middle'], ['9ol.', 'Right ring'], ["0p;/-=[]\\'\n\t", 'Right pinky']];
  return groups.find(([keys]) => keys.includes(k))?.[1] ?? 'Thumbs';
}
export function shiftForKey(key: string) { return key !== baseKeyFor(key) ? fingerForKey(key).startsWith('Left') ? 'Right Shift' : 'Left Shift' : ''; }
export const typingRegions: TypingRegion[] = [
  ['home-row-plains', 'Home Row Plains', 50, 'lesson', 'Discover the anchors beneath your fingertips.'],
  ['letter-forest', 'Letter Forest', 75, 'lesson', 'Explore every letter with deliberate technique.'],
  ['word-city', 'Word City', 75, 'words', 'Build a fluent rhythm through familiar words.'],
  ['sentence-valley', 'Sentence Valley', 75, 'sentences', 'Turn careful keystrokes into connected thoughts.'],
  ['number-factory', 'Number Factory', 60, 'numbers', 'Keep synthetic dates, figures and symbols precise.'],
  ['accuracy-fortress', 'Accuracy Fortress', 75, 'punctuation', 'Make every character count.'],
  ['typing-speed-circuit', 'Speed Circuit', 75, 'test', 'Increase pace while protecting accuracy.'],
  ['coding-district', 'Coding District', 100, 'code', 'Practice the syntax that brings ideas to life.'],
  ['endurance-mountains', 'Endurance Mountains', 50, 'paragraphs', 'Find a steady pace for longer passages.'],
  ['grandmaster-arena', 'Grandmaster Arena', 100, 'code', 'Combine precision, rhythm and complex syntax.'],
].map(([id, name, levels, mode, description]) => ({ id, name, levels, mode, description, accent: '#a8d4db' } as TypingRegion));
export const codeLanguages = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'PHP', 'SQL', 'HTML', 'CSS', 'JSON', 'Bash', 'Markdown', 'Django templates', 'React/JSX'];
const snippets: Record<string, string[]> = {
  Python: ['def greet(name):\n    return f"Hello, {name}!"', 'scores = [12, 18, 24]\nfor score in scores:\n    print(score * 2)', 'class Garden:\n    def __init__(self, name):\n        self.name = name', 'async def load_page(client):\n    result = await client.get("/garden")\n    return result', 'squares = {n: n ** 2 for n in range(5)}'],
  JavaScript: ['const add = (a, b) => a + b;\nconsole.log(add(3, 7));', 'const garden = { name: "Maple", plants: ["fern", "mint"] };\nlet count = garden.plants.length;', 'async function loadItems() {\n    const response = await fetch("/items");\n    return response.json();\n}', 'Promise.resolve([1, 2, 3]).then(items => items.map(n => n * 2));'],
  TypeScript: ['interface Note {\n    id: number;\n    title: string;\n}\nconst note: Note = { id: 7, title: "Practice" };', 'function first<T>(items: T[]): T | undefined {\n    return items[0];\n}'],
  Java: ['public class Garden {\n    public static void main(String[] args) {\n        System.out.println("Keep growing");\n    }\n}'],
  C: ['#include <stdio.h>\nint main(void) {\n    int count = 5;\n    printf("Count: %d\\n", count);\n    return 0;\n}'],
  'C++': ['#include <vector>\n#include <iostream>\nint main() {\n    std::vector<int> values{2, 4, 6};\n    for (const auto& value : values) {\n        std::cout << value << "\\n";\n    }\n}'],
  'C#': ['public record Note(int Id, string Title);\nvar notes = new List<Note> { new(1, "Practice") };\nforeach (var note in notes) {\n    Console.WriteLine(note.Title);\n}'],
  PHP: ['<?php\nfunction welcome(string $name): string {\n    return "Welcome, " . $name;\n}\necho welcome("Explorer");'],
  SQL: ['SELECT category, COUNT(*) AS total\nFROM fictional_products\nGROUP BY category\nORDER BY total DESC;', 'SELECT p.name, o.quantity\nFROM fictional_products p\nJOIN fictional_orders o ON o.product_id = p.id\nWHERE o.quantity > 3;', "INSERT INTO fictional_products (name, price) VALUES ('Maple Kit', 12.50);\nUPDATE fictional_products SET price = 13.00 WHERE id = 7;\nDELETE FROM fictional_products WHERE id = 99;"],
  HTML: ['<main>\n    <section aria-label="Practice">\n        <h1>A little progress</h1>\n        <button type="button">Continue</button>\n    </section>\n</main>', '<form>\n    <label for="name">Name</label>\n    <input id="name" type="text" />\n</form>'],
  CSS: [':root {\n    --space: 16px;\n}\n.card {\n    display: flex;\n    gap: var(--space);\n    align-items: center;\n}', '@media (min-width: 640px) {\n    .grid {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);\n    }\n}'],
  JSON: ['{\n    "name": "MindForge",\n    "version": 1,\n    "features": ["typing", "puzzles"],\n    "enabled": true\n}'],
  Bash: ['#!/bin/bash\nfor item in maple cedar pine; do\n    printf "%s\\n" "$item"\ndone'],
  Markdown: ['# Practice Journal\n\n## Today\n- Keep a steady rhythm.\n- Accuracy before speed.\n\n**Small steps** build confidence.'],
  'Django templates': ['{% extends "base.html" %}\n{% block content %}\n    {% for note in notes %}\n        <p>{{ note.title }}</p>\n    {% endfor %}\n{% endblock %}'],
  'React/JSX': ['function Greeting({ name }) {\n    return <section className="greeting">\n        <h1>Hello, {name}!</h1>\n        <button onClick={() => alert("Ready")}>Start</button>\n    </section>;\n}'],
};
const common = 'the and that have with this from they will would a an in on to for it is as be by we you your are can do make more little one time day way think learn read write work play good new home book sun cat dog'.split(' ');
const intermediate = 'computer learning keyboard science memory browser building bubble database garden forest river window pattern practice accurate rhythm curious balance letter planet journey forward project develop'.split(' ');
const advanced = 'architecture synchronization implementation entrepreneurship configuration entrepreneurial interdisciplinary characterization electromagnetic misinterpretation punctuation professional responsibility extraordinary'.split(' ');
const sentences = [
  'The developer carefully reviewed the application before deployment.', 'A patient gardener checks the soil before planting a seed.',
  'Small, careful steps can turn a difficult task into a familiar routine.', 'The observatory opened its dome as the first stars appeared.',
  'Our fictional studio designed a quiet workspace beside the river.', 'She compared the two patterns and recorded the subtle difference.',
  'A clear explanation gives every reader room to understand the idea.', 'The explorers mapped a safe route through the misty valley.',
  'Before printing a page, check its title, spacing, and punctuation.', 'The team tested each function and documented the result.',
];
const paragraphs = [
  'The workshop was quiet when the first prototype arrived. Mira placed it beside a notebook and began recording observations. Every small adjustment changed the way the pieces moved together. By evening, the team had learned more from careful testing than from their early guesses.',
  'Beyond the fictional town of Cedar Bay, a footpath followed the river. The morning light revealed tiny patterns in the stones. A visitor paused to draw them, then noticed how each shape repeated with a small variation. The walk became an exercise in patient attention.',
  'A useful program begins with a clear question. The developer describes the input, chooses a simple representation, and checks the output against examples. Naming and documentation help the next reader follow the reasoning. Good tools leave space for thoughtful work.',
  'In the archive of an imaginary space station, every discovery had a story. A faded diagram described an early navigation experiment. A newer entry explained how the crew improved the system. The records connected yesterday\'s questions with tomorrow\'s plans.',
];
export function generateTypingText(config: TypingConfig): string {
  const random = seededRandom(`typing:v1:${config.seed}`), pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const mode = config.mode, lesson = typingLessons.find(l => l.id === config.lessonId);
  if (mode === 'lesson' && lesson) {
    const letters = lesson.keys.split(''), groups = lesson.order <= 5 ? 8 : 14 + config.difficulty;
    return Array.from({ length: groups }, () => Array.from({ length: lesson.order <= 5 ? 2 : 3 }, () => pick(letters)).join('')).join(' ');
  }
  if (mode === 'spelling') return pick(['keyboard', 'planet', 'garden', 'river', 'memory', 'science']);
  if (mode === 'completion' || mode === 'puzzle') return typingQuestion(config).answer;
  if (mode === 'adventure') return storyChapters[(config.difficulty - 1) % storyChapters.length].text;
  if (mode === 'flash' || mode === 'reaction') return pick(config.difficulty < 4 ? intermediate : advanced);
  if (mode === 'memory') return config.difficulty < 3 ? pick(sentences).split(' ').slice(0, 5).join(' ') : pick(sentences);
  const bank = config.difficulty < 3 ? common : config.difficulty < 6 ? [...common, ...intermediate] : [...intermediate, ...advanced];
  const targets = [...(config.focusKeys ?? []), ...(config.focusPatterns ?? [])].map(x => x.toLowerCase());
  const targeted = [...common, ...intermediate, ...advanced].filter(word => targets.some(key => word.includes(key)));
  const word = () => {
    if (mode === 'space') return pick(config.difficulty < 3 ? [...common, 'x', 'y', 'go'] : [...intermediate, 'x=>x+1', '[]', '===', 'await', 'return', 'map(x)']);
    if (mode === 'adaptive' && targets.length && random() < .7) { const target = pick(targets); const matching = targeted.filter(w => w.includes(target)); return matching.length ? pick(matching) : `${pick(intermediate)}${target}`; }
    const value = pick(bank);
    return config.difficulty >= 6 && ['test', 'words'].includes(mode) && random() < .2 ? `${value[0].toUpperCase()}${value.slice(1)}${pick([';', '!', ',', '42'])}` : value;
  };
  const count = config.wordCount || (config.duration ? Math.ceil(config.duration * 6) : 10 + config.difficulty * 5);
  if (['test', 'words', 'adaptive', 'falling', 'defense', 'space'].includes(mode)) return Array.from({ length: count }, word).join(' ');
  const parts: string[] = [];
  const targetLength = config.duration ? Math.max(1000, config.duration * 35) : config.wordCount ? config.wordCount * 6 : 100 + config.difficulty * 20;
  do {
    if (mode === 'code') {
      const code = pick(snippets[config.language || 'JavaScript'] || snippets.JavaScript);
      parts.push(code.replace(/^( +)/gm, spaces => config.indentation === 'tab' ? '\t'.repeat(spaces.length / 4) : ' '.repeat(spaces.length / 4 * Number(config.indentation || 2))));
    } else if (mode === 'terminal') parts.push(pick(['git status', 'git branch', 'git switch practice-branch', 'git add notes.md', 'git commit -m "Add practice notes"', 'git log --oneline', 'git pull', 'git push', 'git merge practice-branch', 'git checkout main', 'npm install', 'python manage.py runserver', 'docker compose up']));
    else if (mode === 'numbers' || mode === 'numpad') parts.push(Array.from({ length: 5 }, () => `${Math.floor(random() * 9999)}${random() < .4 ? `.${Math.floor(random() * 90 + 10)}` : ''}`).join(' '));
    else if (mode === 'symbols') parts.push(Array.from({ length: 8 }, () => pick(['{}', '[]', '()', '<>', '=>', '::', '&&', '||', '!=', '===', '+=', '-=', '${value}', '!@#', '$%^', '&*()', '_+=', '`~', '\\|', ':;'])).join(' '));
    else if (mode === 'data-entry') parts.push(`Item: Cedar-${Math.floor(random() * 900 + 100)}\tQty: ${Math.floor(random() * 40 + 1)}\tPrice: ${(random() * 90 + 10).toFixed(2)}\tDate: 2026-09-12`);
    else if (mode === 'punctuation') parts.push(pick(['"Ready?" she asked. "Yes, let\'s begin!"', 'First: check the list; next, review the notes.', 'The small package (marked blue) arrived on time.', 'Well-tested ideas deserve a second look: can you explain why?']));
    else if (mode === 'sentences') parts.push(pick(sentences));
    else parts.push(pick(paragraphs));
  } while (parts.join(' ').length < targetLength);
  return parts.join(['code', 'terminal', 'data-entry'].includes(mode) ? '\n\n' : '\n');
}
export function campaignTypingConfig(regionId: string, level: number): TypingConfig {
  const region = typingRegions.find(r => r.id === regionId);
  if (!region || !Number.isInteger(level) || level < 1 || level > region.levels) throw new Error('Unknown typing campaign level.');
  const difficulty = Math.min(8, 1 + Math.floor((level - 1) * 8 / region.levels));
  return { ...defaultTypingConfig, mode: region.mode, region: region.id, level, difficulty, targetWpm: 15 + difficulty * 10, seed: `typing-campaign:v1:${region.id}:${level}`, duration: region.mode === 'test' ? 60 : region.mode === 'paragraphs' ? Math.min(1800, 60 + Math.floor((level - 1) / 2) * 60) : 0, wordCount: region.mode === 'words' ? 10 + difficulty * 5 : 0, correction: regionId === 'accuracy-fortress' ? 'perfect' : 'strict', lessonId: region.mode === 'lesson' ? `lesson-${regionId === 'home-row-plains' ? 1 + (level - 1) % 6 : 7 + (level - 1) % 13}` : undefined, language: codeLanguages[(level - 1) % codeLanguages.length] };
}
export function dailyTypingConfig(date = new Date().toISOString().slice(0, 10)): TypingConfig { return { ...defaultTypingConfig, seed: `typing-daily:v1:${date}`, date, duration: 60, difficulty: 3, correction: 'free', ranked: true }; }
export function typingWorkout(results: GameResult[], minutes = 10, date = new Date().toISOString().slice(0, 10)): TypingConfig[] {
  const prior = results.filter(r => r.typing && r.completedAt.slice(0, 10) < date).sort((a, b) => a.completedAt.localeCompare(b.completedAt)).slice(-10);
  const accuracy = prior.length ? prior.reduce((s, r) => s + r.accuracy, 0) / prior.length : 100;
  const difficulty = Math.max(1, Math.min(8, (prior.at(-1)?.difficulty ?? 1) + (prior.length >= 3 && accuracy >= 97 ? 1 : accuracy < 85 ? -1 : 0)));
  const keys: Record<string, number> = {};
  for (const r of prior) for (const row of Object.values(r.typing!.keyStats)) keys[row.key] = (keys[row.key] ?? 0) + row.incorrect;
  const focusKeys = Object.keys(keys).sort((a, b) => keys[b] - keys[a]).slice(0, 5);
  return (['adaptive', 'punctuation', 'test', 'sentences', 'code'] as const).map((mode, index) => ({ ...defaultTypingConfig, mode, seed: `typing-workout:v1:${date}:${index}`, date, workoutIndex: index, duration: Math.max(15, Math.round(minutes * 60 / 5)), difficulty, focusKeys, correction: index === 1 ? 'strict' : 'free' }));
}
