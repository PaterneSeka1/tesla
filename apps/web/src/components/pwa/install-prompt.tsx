'use client';

import { Copy, Download, Share, SquarePlus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isImmersivePath } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  INSTALL_DECLARED_KEY,
  INSTALL_DISMISSED_KEY,
  INSTALL_CHANGED_EVENT,
  INSTALLABLE_EVENT,
  OPEN_INSTALL_EVENT,
  currentInstallGuide,
  type InstallGuide,
  isInstallPromptExcluded,
  readFlag,
  writeFlag,
} from '@/lib/pwa-install';

const session = () => window.sessionStorage;
const local = () => window.localStorage;

/** Laisse la page s'afficher avant l'invitation (et l'événement natif arriver). */
const DELAY_MS = 1200;

/**
 * Invitation à installer l'application (D184) lorsqu'elle est ouverte dans le navigateur : bouton
 * d'installation (Android, Chrome, Edge), geste expliqué (iPhone, iPad) ou ouverture dans le
 * navigateur (applications tierces). « Plus tard » vaut jusqu'à la fermeture de l'onglet.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const excluded = isInstallPromptExcluded(pathname) || isImmersivePath(pathname);
  const [guide, setGuide] = useState<InstallGuide>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Demande explicite depuis le menu : ignore « Plus tard » et « déjà installée ».
  useEffect(() => {
    const onRequest = () => {
      const next = currentInstallGuide();
      if (!next) return;
      setGuide(next);
      setCopied(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_INSTALL_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, onRequest);
  }, []);

  useEffect(() => {
    if (excluded) return;
    const evaluate = () => {
      if (readFlag(session, INSTALL_DISMISSED_KEY)) return;
      const next = currentInstallGuide();
      if (!next || (next === 'IOS' && readFlag(local, INSTALL_DECLARED_KEY))) return;
      setGuide(next);
      setOpen(true);
    };
    const timer = window.setTimeout(evaluate, DELAY_MS);
    const onInstalled = () => {
      writeFlag(session, INSTALL_DISMISSED_KEY);
      setOpen(false);
    };
    window.addEventListener(INSTALLABLE_EVENT, evaluate);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INSTALLABLE_EVENT, evaluate);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [excluded]);

  const later = () => {
    writeFlag(session, INSTALL_DISMISSED_KEY);
    setOpen(false);
  };

  const install = async () => {
    const event = window.__teslaInstallPrompt;
    // Une invitation native ne sert qu'une fois.
    window.__teslaInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_CHANGED_EVENT));
    if (event) {
      await event.prompt();
      await event.userChoice;
    }
    later();
  };

  const alreadyInstalled = () => {
    writeFlag(local, INSTALL_DECLARED_KEY);
    setOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!guide) return null;

  return (
    <Dialog open={open && !excluded} onOpenChange={(value) => !value && later()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Installer Nikola Tesla Académie</DialogTitle>
          <DialogDescription>
            {guide === 'IN_APP'
              ? 'Ce lien est ouvert dans le navigateur d’une autre application, qui ne permet pas l’installation.'
              : 'Ajoutez l’application à votre écran d’accueil : elle s’ouvre en plein écran, en un geste, et vos cours préparés restent disponibles sans connexion.'}
          </DialogDescription>
        </DialogHeader>

        {guide === 'IOS' && (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                1
              </span>
              <span>
                Touchez le bouton <strong>Partager</strong>{' '}
                <Share className="inline size-4 align-text-bottom" aria-hidden /> dans la barre de
                Safari (sous « ··· » selon la version d’iOS).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                2
              </span>
              <span>
                Choisissez <strong>Sur l’écran d’accueil</strong>{' '}
                <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> (faites
                défiler la liste si nécessaire).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                3
              </span>
              <span>
                Touchez <strong>Ajouter</strong>, puis ouvrez l’application depuis son icône.
              </span>
            </li>
          </ol>
        )}

        {guide === 'IN_APP' && (
          <p className="text-sm">
            Touchez le menu de cette application (« ··· » ou ⋮), puis{' '}
            <strong>Ouvrir dans le navigateur</strong> : Safari sur iPhone, Chrome sur Android. Vous
            pourrez alors installer l’application.
          </p>
        )}

        <DialogFooter>
          {guide === 'IOS' && (
            <Button variant="ghost" onClick={alreadyInstalled}>
              Elle est déjà installée
            </Button>
          )}
          <Button variant="outline" onClick={later}>
            Plus tard
          </Button>
          {guide === 'NATIVE' && (
            <Button onClick={() => void install()}>
              <Download aria-hidden />
              Installer
            </Button>
          )}
          {guide === 'IN_APP' && (
            <Button onClick={() => void copyLink()}>
              <Copy aria-hidden />
              {copied ? 'Lien copié' : 'Copier le lien'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
