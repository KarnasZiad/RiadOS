import { createContext, use } from 'react';
import { type ApiClient, api } from './api-client';

/** The application uses the shared client; tests provide one with a mocked fetch. */
export const ApiContext = createContext<ApiClient>(api);

export function useApi(): ApiClient {
  return use(ApiContext);
}
