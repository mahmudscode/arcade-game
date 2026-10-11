import { getSettings, useSettings } from './settings';

/** English is the source of truth; other languages fall back to it key by key. */
const en = {
  'nav.games': 'Games',
  'nav.categories': 'Categories',
  'nav.leaderboards': 'Leaderboards',
  'nav.favorites': 'Favorites',
  'nav.achievements': 'Achievements',
  'nav.settings': 'Settings',
  'tab.home': 'Home',
  'tab.browse': 'Browse',
  'tab.scores': 'Scores',
  'tab.saved': 'Saved',
  'daily.title': 'DAILY CHALLENGE',
  'daily.same': 'Same seed for every player today.',
  'daily.best': "Today's best: {score}.",
  'daily.streak': '{n}-day streak.',
  'daily.start': 'Play to start a streak.',
  'daily.play': "Play today's challenge",
  'daily.again': 'Beat your score',
  'player.pause': 'Pause',
  'player.resume': 'Resume',
  'player.restart': 'Restart',
  'player.save': 'Save state',
  'player.saved': 'Saved ✓',
  'player.favorite': 'Favorite',
  'player.favorited': 'Favorited',
  'player.share': 'Share',
  'player.copied': 'Link copied',
  'player.shareScore': 'Share score',
  'player.shared': 'Shared ✓',
  'player.playAgain': 'Play again',
  'player.howTo': 'How to play',
  'player.sound': 'Sound',
  'achievements.title': 'Achievements',
  'achievements.summary': '{n} of {total} unlocked. Progress is saved on this browser.',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.sound': 'Sound and motion',
  'settings.reduceMotion': 'Reduce motion (turns off animations and transitions in the site)',
  'settings.crt': 'CRT screen effect (scanlines and a soft vignette over the game)',
  'settings.contrast': 'High contrast (brighter text and borders around the site)',
} as const;

export type Key = keyof typeof en;

const es: Partial<Record<Key, string>> = {
  'nav.games': 'Juegos',
  'nav.categories': 'Categorías',
  'nav.leaderboards': 'Clasificaciones',
  'nav.favorites': 'Favoritos',
  'nav.achievements': 'Logros',
  'nav.settings': 'Ajustes',
  'tab.home': 'Inicio',
  'tab.browse': 'Explorar',
  'tab.scores': 'Puntos',
  'tab.saved': 'Guardados',
  'daily.title': 'RETO DIARIO',
  'daily.same': 'Hoy todos juegan con la misma semilla.',
  'daily.best': 'Mejor de hoy: {score}.',
  'daily.streak': 'Racha de {n} días.',
  'daily.start': 'Juega para empezar una racha.',
  'daily.play': 'Jugar el reto de hoy',
  'daily.again': 'Supera tu puntuación',
  'player.pause': 'Pausa',
  'player.resume': 'Continuar',
  'player.restart': 'Reiniciar',
  'player.save': 'Guardar partida',
  'player.saved': 'Guardado ✓',
  'player.favorite': 'Favorito',
  'player.favorited': 'En favoritos',
  'player.share': 'Compartir',
  'player.copied': 'Enlace copiado',
  'player.shareScore': 'Compartir puntuación',
  'player.shared': 'Compartido ✓',
  'player.playAgain': 'Jugar de nuevo',
  'player.howTo': 'Cómo se juega',
  'player.sound': 'Sonido',
  'achievements.title': 'Logros',
  'achievements.summary': '{n} de {total} desbloqueados. El progreso se guarda en este navegador.',
  'settings.title': 'Ajustes',
  'settings.language': 'Idioma',
  'settings.sound': 'Sonido y movimiento',
  'settings.reduceMotion': 'Reducir movimiento (desactiva animaciones y transiciones del sitio)',
  'settings.crt': 'Efecto pantalla CRT (líneas de escaneo y viñeta sobre el juego)',
  'settings.contrast': 'Alto contraste (texto y bordes más brillantes en el sitio)',
};

const fr: Partial<Record<Key, string>> = {
  'nav.games': 'Jeux',
  'nav.categories': 'Catégories',
  'nav.leaderboards': 'Classements',
  'nav.favorites': 'Favoris',
  'nav.achievements': 'Succès',
  'nav.settings': 'Réglages',
  'tab.home': 'Accueil',
  'tab.browse': 'Parcourir',
  'tab.scores': 'Scores',
  'tab.saved': 'Favoris',
  'daily.title': 'DÉFI DU JOUR',
  'daily.same': "Aujourd'hui, tout le monde joue avec la même graine.",
  'daily.best': "Meilleur score du jour : {score}.",
  'daily.streak': 'Série de {n} jours.',
  'daily.start': 'Jouez pour lancer une série.',
  'daily.play': "Jouer le défi du jour",
  'daily.again': 'Battez votre score',
  'player.pause': 'Pause',
  'player.resume': 'Reprendre',
  'player.restart': 'Recommencer',
  'player.save': 'Sauvegarder',
  'player.saved': 'Sauvegardé ✓',
  'player.favorite': 'Favori',
  'player.favorited': 'Dans les favoris',
  'player.share': 'Partager',
  'player.copied': 'Lien copié',
  'player.shareScore': 'Partager le score',
  'player.shared': 'Partagé ✓',
  'player.playAgain': 'Rejouer',
  'player.howTo': 'Comment jouer',
  'player.sound': 'Son',
  'achievements.title': 'Succès',
  'achievements.summary': '{n} sur {total} débloqués. La progression est enregistrée dans ce navigateur.',
  'settings.title': 'Réglages',
  'settings.language': 'Langue',
  'settings.sound': 'Son et animations',
  'settings.reduceMotion': 'Réduire les animations (désactive animations et transitions du site)',
  'settings.crt': "Effet écran CRT (lignes de balayage et vignette sur le jeu)",
  'settings.contrast': 'Contraste élevé (texte et bordures plus lumineux sur le site)',
};

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
] as const;
export type Language = (typeof LANGUAGES)[number]['id'];

const DICTS: Record<Language, Partial<Record<Key, string>>> = { en, es, fr };

/** The browser's language if we have it, otherwise English. */
export function detectLanguage(): Language {
  const tag = (typeof navigator === 'undefined' ? 'en' : navigator.language).slice(0, 2).toLowerCase();
  return LANGUAGES.some((l) => l.id === tag) ? (tag as Language) : 'en';
}

/** Looks a string up in a language (falling back to English) and fills `{name}` placeholders. */
export function translate(lang: Language, key: Key, vars: Record<string, string | number> = {}): string {
  const text = DICTS[lang][key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** A stored language id if we support it, otherwise the browser's. */
export const asLanguage = (id: string): Language => (LANGUAGES.some((l) => l.id === id) ? (id as Language) : detectLanguage());

export const currentLanguage = (): Language => asLanguage(getSettings().language);

/** `t('key', vars)` in the player's language; re-renders when the language changes. */
export function useT(): (key: Key, vars?: Record<string, string | number>) => string {
  const { language } = useSettings();
  const lang = asLanguage(language);
  return (key, vars) => translate(lang, key, vars);
}
