import { describe, it, expect } from 'vitest';
import { computeDiff } from '../utils/diff';

describe('computeDiff', () => {
  it('returns empty array for two empty strings', () => {
    expect(computeDiff('', '')).toEqual([]);
  });

  it('returns all same lines when texts are identical', () => {
    const result = computeDiff('hello\nworld', 'hello\nworld');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'same', text: 'hello' });
    expect(result[1]).toEqual({ type: 'same', text: 'world' });
  });

  it('detects added lines', () => {
    const result = computeDiff('hello', 'hello\nworld');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'same', text: 'hello' });
    expect(result[1]).toEqual({ type: 'add', text: 'world', lineNum: 2 });
  });

  it('detects removed lines', () => {
    const result = computeDiff('hello\nworld', 'hello');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'same', text: 'hello' });
    expect(result[1]).toEqual({ type: 'remove', text: 'world', lineNum: 2 });
  });

  it('detects changed lines', () => {
    const result = computeDiff('hello', 'world');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'remove', text: 'hello', lineNum: 1 });
    expect(result[1]).toEqual({ type: 'add', text: 'world', lineNum: 1 });
  });

  it('handles multiple sequential changes', () => {
    const result = computeDiff('a\nb\nc', 'a\nx\nc');
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ type: 'same', text: 'a' });
    expect(result[1].type).toBe('remove');
    expect(result[1].text).toBe('b');
    expect(result[2].type).toBe('add');
    expect(result[2].text).toBe('x');
    expect(result[3]).toEqual({ type: 'same', text: 'c' });
  });

  it('handles trailing newline differences', () => {
    const result = computeDiff('hello\n', 'hello\nworld\n');
    expect(result.length).toBeGreaterThanOrEqual(2);
    // First line should be same
    expect(result[0]).toEqual({ type: 'same', text: 'hello' });
  });
});
