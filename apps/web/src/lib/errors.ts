import { ApiError } from './api-client';

const MESSAGES_BY_STATUS: Record<number, string> = {
  400: 'Vérifiez les informations saisies.',
  401: 'Votre session a expiré. Reconnectez-vous.',
  403: "Votre rôle ne permet pas d'effectuer cette action.",
  404: "Cet élément n'existe plus.",
  409: 'Cette action entre en conflit avec des données existantes.',
  422: 'Cette demande ne respecte pas les règles métier.',
  429: 'Trop de tentatives. Réessayez dans une minute.',
};

/** User-facing message in French; specific screens can override any status. */
export function describeError(error: unknown, overrides: Record<number, string> = {}): string {
  if (error instanceof ApiError) {
    return (
      overrides[error.status] ?? MESSAGES_BY_STATUS[error.status] ?? 'Une erreur est survenue.'
    );
  }
  return 'Le serveur est injoignable. Vérifiez votre connexion.';
}

/** Reads a text field of a form; file inputs and missing fields give an empty string. */
export function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}
