import createClient from 'openapi-fetch';

export const createApiClient = <TPaths extends object>(baseUrl: string) => {
  return createClient<TPaths>({ baseUrl });
};
