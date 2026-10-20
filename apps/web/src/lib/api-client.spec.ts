import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './api-client';
import type { SessionResponse } from './types';

const session: SessionResponse = {
  accessToken: 'fresh-token',
  expiresIn: 900,
  user: {
    id: 'u1',
    email: 'reception@riad-yasmine.ma',
    fullName: 'Youssef Alaoui',
    role: 'RECEPTION',
    tenant: { id: 't1', name: 'Riad Yasmine' },
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  return { client: new ApiClient('/api', fetchMock), fetchMock };
}

function requestOf(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, call: number) {
  const [url, init] = fetchMock.mock.calls[call] ?? [];
  return { url, init, headers: new Headers(init?.headers) };
}

describe('ApiClient', () => {
  it('sends JSON with the access token and same-origin credentials', async () => {
    const { client, fetchMock } = setup(json(201, { id: 'r1' }));
    client.setAccessToken('access-token');

    await expect(client.post('/rooms', { name: 'Atlas' })).resolves.toEqual({ id: 'r1' });

    const { url, init, headers } = requestOf(fetchMock, 0);
    expect(url).toBe('/api/rooms');
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"name":"Atlas"}',
      credentials: 'same-origin',
    });
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('turns error responses into ApiError with the API message', async () => {
    const { client } = setup(
      json(409, {
        statusCode: 409,
        message: 'This room is already booked for some of these nights',
      }),
    );

    const error = await client.get('/reservations').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: 'This room is already booked for some of these nights',
    });
  });

  it('refreshes the session once on 401 and replays the request', async () => {
    const { client, fetchMock } = setup(
      json(401, { message: 'Invalid or expired access token' }),
      json(200, session),
      json(200, [{ id: 'room-1' }]),
    );
    client.setAccessToken('expired-token');

    await expect(client.get('/rooms')).resolves.toEqual([{ id: 'room-1' }]);

    expect(requestOf(fetchMock, 1).url).toBe('/api/auth/refresh');
    expect(requestOf(fetchMock, 2).headers.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('merges concurrent refreshes into a single request', async () => {
    const { client, fetchMock } = setup(json(200, session));

    const [first, second] = await Promise.all([client.refresh(), client.refresh()]);

    expect(first).toEqual(session);
    expect(second).toEqual(session);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('notifies the application when the session cannot be refreshed', async () => {
    const { client } = setup(json(401, {}), json(401, { message: 'Refresh token reuse detected' }));
    const expired = vi.fn();
    client.onSessionExpired(expired);

    await expect(client.get('/rooms')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh when an auth endpoint answers 401', async () => {
    const { client, fetchMock } = setup(json(401, { message: 'Invalid email or password' }));

    await expect(client.post('/auth/login', {})).rejects.toThrow('Invalid email or password');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a network failure during refresh as an expired session', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new ApiClient('/api', fetchMock);

    await expect(client.refresh()).resolves.toBeNull();
  });

  it('returns undefined for 204 responses and supports PATCH', async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 204 }));

    await expect(client.patch('/rooms/1', { isActive: false })).resolves.toBeUndefined();
    expect(requestOf(fetchMock, 0).init?.method).toBe('PATCH');
  });
});
