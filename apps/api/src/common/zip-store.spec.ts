import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createZip } from './zip-store.js';

function hasUnzip(): boolean {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('createZip', () => {
  it('produit une archive lisible dont les fichiers sont restitués à l’identique', () => {
    const entries = [
      { name: 'NT-2027-000001_KOUASSI_Eric.pdf', data: Buffer.from('%PDF-1.7 premier') },
      { name: 'NT-2027-000002.pdf', data: Buffer.from('%PDF-1.7 second') },
    ];
    const zip = createZip(entries, new Date(2027, 0, 15, 10, 30));
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2);
    if (!hasUnzip()) return;
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    writeFileSync(join(dir, 'lot.zip'), zip);
    execFileSync('unzip', ['-t', '-q', join(dir, 'lot.zip')]);
    execFileSync('unzip', ['-q', join(dir, 'lot.zip'), '-d', join(dir, 'out')]);
    for (const entry of entries) {
      expect(readFileSync(join(dir, 'out', entry.name))).toEqual(entry.data);
    }
  });

  it('refuse une archive vide', () => {
    expect(() => createZip([])).toThrow(RangeError);
  });
});
