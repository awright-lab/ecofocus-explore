import { describe, expect, it, vi } from 'vitest';
import { searchTools, toolInfo } from '../toolCatalog';
import type { StudioCommand } from '../StudioTools';
const command = (id: string, label: string): StudioCommand => ({ id, label, group: 'Test', run: vi.fn() });
describe('tool library search', () => {
  it('ranks exact and prefix names before alias matches and keeps ties stable', () => {
    const items = [command('pptx', 'Export PowerPoint'), command('a', 'Power'), command('b', 'Power tools'), command('c', 'Power tools')];
    expect(searchTools(items, 'power', 'All tools').map(x => x.command.id)).toEqual(['a', 'b', 'c', 'pptx']);
    expect(searchTools(items, 'slides', 'All tools')[0].command.id).toBe('pptx');
  });
  it('uses safe fallback for reserved and unknown identities', () => {
    for (const id of ['constructor', '__proto__', 'toString', '工具']) expect(toolInfo(command(id, id)).category).toBe('Other tools');
  });
  it('finds task aliases and filters categories', () => {
    const items = [command('data-preparation', 'Clean study'), command('wave-review', 'Review'), command('linear-model', 'Numeric'), command('pages', 'Pages')];
    for (const [q, id] of [['recode', 'data-preparation'], ['compare years', 'wave-review'], ['regression', 'linear-model'], ['arrange', 'pages']]) expect(searchTools(items, q, 'All tools')[0].command.id).toBe(id);
    expect(searchTools(items, 'recode', 'Design pages')).toHaveLength(0);
  });
});
