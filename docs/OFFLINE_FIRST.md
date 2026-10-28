# Stratégie hors ligne (PWA)

## État actuel (phase 0)

| Élément | Fichier | État |
| --- | --- | --- |
| Manifest | `apps/web/src/app/manifest.ts` → `/manifest.webmanifest` | ✅ |
| Icônes 192/512/maskable/Apple | `apps/web/public/icons/` (générées depuis le logo) | ✅ |
| Service worker | `apps/web/public/sw.js`, enregistré **en production uniquement** | ✅ |
| Page hors ligne | `/hors-ligne` | ✅ |
| Cache statique | `/_next/static/`, `/icons/`, `/brand/` : cache d'abord | ✅ |
| Structure IndexedDB | `apps/web/src/lib/offline/db.ts` (`modules`, `lessons`, `syncQueue`) | ✅ définie, non utilisée |
| Téléchargement de modules | — | ❌ phase 3 |
| Synchronisation | — | ❌ phase 3–4 |

### Comportement du service worker
- **Navigation** : réseau d'abord ; en cas d'échec, `/hors-ligne`. Les pages HTML ne sont **pas** mises en cache (elles pourront contenir des données personnelles).
- **Ressources statiques versionnées** : cache d'abord, ajoutées au cache à la première requête.
- **API** (autre origine) : jamais interceptée, jamais mise en cache par le service worker.
- Mise à jour : changer `VERSION` dans `sw.js` purge les anciens caches `tesla-*`.

## Stratégie cible

1. **Lecture hors ligne (phase 3)** : le routier télécharge explicitement un module publié. Le contenu (texte, images légères) est stocké dans IndexedDB (`modules`, `lessons`) avec sa `version`. À la reconnexion, comparaison des versions et proposition de mise à jour.
2. **Progression de lecture** : enregistrée localement dans `syncQueue`, envoyée à la reconnexion (idempotence par identifiant client).
3. **Évaluations (phase 4)** : par défaut **en ligne uniquement**. Un mode hors ligne ne sera envisagé qu'après arbitrage (risque de fraude, horodatage, conflits).
4. **Synchronisation** : file FIFO, renvoi au retour du réseau (`online`), en cas d'échec réessai avec backoff ; le serveur reste la source de vérité.

## Données autorisées hors ligne
- ✅ Contenu des modules publiés, métadonnées de version, progression de lecture.
- ❌ Jetons de session (cookie httpOnly uniquement), données d'autres routiers, résultats d'évaluation détaillés, données de santé ou de contact.
- À la déconnexion : purge d'IndexedDB et des caches liés à l'utilisateur.
