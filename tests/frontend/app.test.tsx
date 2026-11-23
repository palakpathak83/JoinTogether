import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../src/context/AuthContext.tsx';
import { LoginPage } from '../../src/pages/AuthPages.tsx';
import LandingPage from '../../src/pages/LandingPage.tsx';

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        service: 'JoinTogether API',
        status: 'ok',
        database: { state: 'connected', readyState: 1, error: null },
        timestamp: new Date().toISOString(),
      }),
  }))
);

describe('JoinTogether Frontend UI', () => {
  it('keeps the landing page rendered when the health endpoint returns HTML', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '<!doctype html><html><body>SPA fallback</body></html>',
    }) as Response);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        name: /Find verified partners for shared orders, routes, teams, and events/i,
      })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        'Health endpoint returned an unexpected response. Check that VITE_API_URL points to the API service.'
      );
    });
    errorSpy.mockRestore();
  });

  it('renders the LandingPage with 3-zone header, headline, and all 4 matching categories', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('JoinTogether').length).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.getByRole('heading', {
        name: /Find verified partners for shared orders, routes, teams, and events/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Hackathon Team Formation')).toBeInTheDocument();
    expect(screen.getByText('Group Buying & Order Splits')).toBeInTheDocument();
    expect(screen.getByText('Shared Routes & Carpools')).toBeInTheDocument();
    expect(screen.getByText('Conferences, Workshops & Live Events')).toBeInTheDocument();
  });

  it('renders LoginPage form controls cleanly', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });
});
