export interface DiffLine {
  type: 'same' | 'add' | 'remove';
  text: string;
  lineNum?: number;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  // Handle empty strings: split('') returns [''] which we don't want
  if (oldText === '' && newText === '') return [];
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');
  const result: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      result.push({ type: 'add', text: newLines[newIdx], lineNum: newIdx + 1 });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      result.push({ type: 'remove', text: oldLines[oldIdx], lineNum: oldIdx + 1 });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      result.push({ type: 'same', text: oldLines[oldIdx] });
      oldIdx++;
      newIdx++;
    } else {
      // Look ahead to find if this line was removed or added
      const oldInNew = newLines.indexOf(oldLines[oldIdx], newIdx);
      const newInOld = oldLines.indexOf(newLines[newIdx], oldIdx);

      if (oldInNew === -1 || (newInOld !== -1 && newInOld < oldInNew)) {
        result.push({ type: 'remove', text: oldLines[oldIdx], lineNum: oldIdx + 1 });
        oldIdx++;
      } else {
        result.push({ type: 'add', text: newLines[newIdx], lineNum: newIdx + 1 });
        newIdx++;
      }
    }
  }

  return result;
}
