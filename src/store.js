import { configureStore } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/', cache: 'no-store' }),
  tagTypes: ['Portal'],
  endpoints: (build) => ({
    session: build.query({
      query: (params) => ({ url: 'session', params }),
      providesTags: (_result, _error, { account, demo }) =>
        account || demo ? [] : ['Portal'],
    }),
    changePortal: build.mutation({
      query: (body) => ({ url: 'portal', method: 'POST', body }),
      invalidatesTags: (_result, error) => (error ? [] : ['Portal']),
    }),
  }),
});

export const { useSessionQuery, useChangePortalMutation } = portalApi;

export const store = configureStore({
  reducer: { [portalApi.reducerPath]: portalApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(portalApi.middleware),
});

export function portalError(error, fallback = 'Əməliyyat mümkün olmadı. Yenidən cəhd edin.') {
  return error?.data?.error || error?.message || fallback;
}
