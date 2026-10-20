import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderScreen, userWithRole } from '../../../test/render';
import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('shows the property, the user and the main navigation', () => {
    renderScreen(<AppLayout />, { user: userWithRole('OWNER'), route: '/calendar' });

    expect(screen.getByText('Riad Yasmine')).toBeInTheDocument();
    expect(screen.getByText('Propriétaire')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calendrier' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Chambres' })).toHaveAttribute('href', '/rooms');
  });

  it('logs out', async () => {
    const { auth } = renderScreen(<AppLayout />);

    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
