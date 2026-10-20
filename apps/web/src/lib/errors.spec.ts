import { describe, expect, it } from 'vitest';
import { ApiError } from './api-client';
import { describeError, textField } from './errors';

describe('describeError', () => {
  it('describes API errors by status, with screen-specific overrides', () => {
    expect(describeError(new ApiError(403, 'Forbidden'))).toBe(
      "Votre rôle ne permet pas d'effectuer cette action.",
    );
    expect(describeError(new ApiError(409, 'Conflict'), { 409: 'Chambre déjà réservée.' })).toBe(
      'Chambre déjà réservée.',
    );
    expect(describeError(new ApiError(500, 'Boom'))).toBe('Une erreur est survenue.');
  });

  it('describes network failures', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toBe(
      'Le serveur est injoignable. Vérifiez votre connexion.',
    );
  });
});

describe('textField', () => {
  it('reads trimmed text and ignores files or missing fields', () => {
    const form = new FormData();
    form.set('name', '  Atlas ');
    form.set('photo', new File(['x'], 'photo.png'));

    expect(textField(form, 'name')).toBe('Atlas');
    expect(textField(form, 'photo')).toBe('');
    expect(textField(form, 'missing')).toBe('');
  });
});
