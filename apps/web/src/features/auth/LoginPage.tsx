import { useActionState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Alert, Card } from '../../components/ui/feedback';
import { Field, Input, Label } from '../../components/ui/form';
import { describeError, textField } from '../../lib/errors';
import { useAuth } from './auth-context';

const DEFAULT_TARGET = '/calendar';

function redirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state;
    // Only internal paths: never redirect to another site after login.
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
      return from;
    }
  }
  return DEFAULT_TARGET;
}

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, submit, pending] = useActionState(
    async (_previous: string | null, form: FormData) => {
      try {
        await login(textField(form, 'email'), textField(form, 'password'));
        await navigate(redirectTarget(location.state), { replace: true });
        return null;
      } catch (caught) {
        return describeError(caught, { 401: 'E-mail ou mot de passe incorrect.' });
      }
    },
    null,
  );

  if (state.status === 'authenticated') {
    return <Navigate to={DEFAULT_TARGET} replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-semibold text-brand-700">RiadOS</p>
          <h1 className="mt-1 text-sm text-stone-500">Connexion à votre établissement</h1>
        </div>
        <form action={submit} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </Field>
          <Field>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
