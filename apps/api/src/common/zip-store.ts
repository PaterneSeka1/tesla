import { crc32 } from 'node:zlib';

/**
 * Archive ZIP minimale, sans compression (méthode 0 « stockée ») : suffisante pour des PDF déjà
 * compressés, sans dépendance. Noms en UTF-8 (bit 11), aucune extension ZIP64 : le nombre de
 * fichiers et la taille sont bornés par l'appelant (lots papier, D163).
 */
export interface ZipEntry {
  name: string;
  data: Buffer;
}

const MAX_ARCHIVE_BYTES = 0xffff_fffe;

/** Date et heure au format MS-DOS (heure locale du serveur, précision de 2 secondes). */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZip(entries: readonly ZipEntry[], now = new Date()): Buffer {
  if (entries.length === 0 || entries.length > 0xffff) {
    throw new RangeError('Nombre de fichiers hors limites pour une archive ZIP simple.');
  }
  const stamp = dosDateTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version requise
    local.writeUInt16LE(0x0800, 6); // noms UTF-8
    local.writeUInt16LE(0, 8); // stockée
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version créatrice
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    // extra, commentaire, disque, attributs internes et externes : 0
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, entry.data);
    centrals.push(central, name);
    offset += local.length + name.length + entry.data.length;
    if (offset > MAX_ARCHIVE_BYTES) throw new RangeError('Archive ZIP trop volumineuse.');
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
