import { describe, expect, it } from 'vitest';
import {
  decryptJson,
  derivePasswordKey,
  deviceAad,
  encryptJson,
  generateDataKey,
  importDeviceKey,
  passwordAad,
  randomSalt,
  unwrapDataKey,
  wrapDataKey,
} from './vault-crypto';

// Itérations réduites pour la vitesse des tests (600 000 en production, enregistrées dans l'en-tête).
const ITER = 1000;
const deviceKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

describe('Coffre local : mot de passe unique (D180)', () => {
  it('le mot de passe du compte ouvre la clé de données ; un autre mot de passe échoue', async () => {
    const dek = await generateDataKey();
    const salt = randomSalt();
    const wrapped = await wrapDataKey(
      dek,
      await derivePasswordKey('Mot de passe 1', salt, ITER),
      passwordAad('vault:u1'),
    );
    const record = await encryptJson(dek, { lecon: 'Boussole' }, 'u1:module:x');

    const opened = await unwrapDataKey(
      wrapped,
      await derivePasswordKey('Mot de passe 1', salt, ITER),
      passwordAad('vault:u1'),
    );
    expect(opened).not.toBeNull();
    expect(await decryptJson(opened!, record, 'u1:module:x')).toEqual({ lecon: 'Boussole' });
    expect(opened!.extractable).toBe(false);
    expect(
      await unwrapDataKey(
        wrapped,
        await derivePasswordKey('mauvais', salt, ITER),
        passwordAad('vault:u1'),
      ),
    ).toBeNull();
  });

  it('bloc lié au coffre : inutilisable pour un autre compte ou un autre usage', async () => {
    const dek = await generateDataKey();
    const salt = randomSalt();
    const kek = await derivePasswordKey('secret partagé', salt, ITER);
    const wrapped = await wrapDataKey(dek, kek, passwordAad('vault:u1'));
    expect(await unwrapDataKey(wrapped, kek, passwordAad('vault:u2'))).toBeNull();
    expect(await unwrapDataKey(wrapped, kek, deviceAad('vault:u1', 'd1'))).toBeNull();
  });

  it('changement de mot de passe ailleurs : la clé d’appareil reprotège sans perte, l’ancien mot de passe n’ouvre plus', async () => {
    const dek = await generateDataKey();
    const record = await encryptJson(dek, { operation: 'presence' }, 'u1:op:1');
    const device = deviceKey();
    const byDevice = await wrapDataKey(
      dek,
      await importDeviceKey(device),
      deviceAad('vault:u1', 'd1'),
    );
    const oldSalt = randomSalt();
    const byOld = await wrapDataKey(
      dek,
      await derivePasswordKey('ancien', oldSalt, ITER),
      passwordAad('vault:u1'),
    );

    // Après connexion avec le nouveau mot de passe : DEK exportable obtenue par l'appareil…
    const exportable = await unwrapDataKey(
      byDevice,
      await importDeviceKey(device),
      deviceAad('vault:u1', 'd1'),
      true,
    );
    expect(exportable?.extractable).toBe(true);
    const newSalt = randomSalt();
    const byNew = await wrapDataKey(
      exportable!,
      await derivePasswordKey('nouveau', newSalt, ITER),
      passwordAad('vault:u1'),
    );

    // … le nouveau mot de passe ouvre les mêmes données ; l'ancien bloc est remplacé.
    const reopened = await unwrapDataKey(
      byNew,
      await derivePasswordKey('nouveau', newSalt, ITER),
      passwordAad('vault:u1'),
    );
    expect(await decryptJson(reopened!, record, 'u1:op:1')).toEqual({ operation: 'presence' });
    expect(
      await unwrapDataKey(
        byNew,
        await derivePasswordKey('ancien', newSalt, ITER),
        passwordAad('vault:u1'),
      ),
    ).toBeNull();
    expect(byOld).not.toEqual(byNew);
  });

  it('clé d’appareil d’un autre appareil ou malformée : refusée', async () => {
    const dek = await generateDataKey();
    const wrapped = await wrapDataKey(
      dek,
      await importDeviceKey(deviceKey()),
      deviceAad('vault:u1', 'd1'),
    );
    expect(
      await unwrapDataKey(wrapped, await importDeviceKey(deviceKey()), deviceAad('vault:u1', 'd1')),
    ).toBeNull();
    await expect(importDeviceKey(btoa('trop court'))).rejects.toThrow('Clé d’appareil invalide.');
  });

  it('donnée altérée : déchiffrement refusé (chiffrement authentifié)', async () => {
    const dek = await generateDataKey();
    const cipher = await encryptJson(dek, { a: 1 }, 'u1:x');
    cipher.bytes[0] = (cipher.bytes[0]! + 1) % 256;
    await expect(decryptJson(dek, cipher, 'u1:x')).rejects.toBeDefined();
  });
});
