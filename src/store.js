import { configureStore } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/', cache: 'no-store' }),
  tagTypes: ['Portal', 'LiveLesson'],
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
    liveLesson: build.query({
      query: (id) => `lessons/${encodeURIComponent(id)}/live`,
      providesTags: (_result, _error, id) => [{ type: 'LiveLesson', id }],
    }),
    changeLiveLesson: build.mutation({
      query: ({ id, action }) => ({
        url: `lessons/${encodeURIComponent(id)}/live/${action}`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, error, { id }) => error ? [] : [{ type: 'LiveLesson', id }, 'Portal'],
    }),
  }),
});

export const { useSessionQuery, useChangePortalMutation, useLiveLessonQuery, useChangeLiveLessonMutation } = portalApi;

export async function joinLiveLesson(id, signal) {
  // Keep short-lived media credentials out of the Redux store.
  const response = await fetch(`/api/lessons/${encodeURIComponent(id)}/live/join`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(portalError({ data }, 'Canlı dərsə qoşulmaq mümkün olmadı.'));
  return data;
}

export const store = configureStore({
  reducer: { [portalApi.reducerPath]: portalApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(portalApi.middleware),
});

export function portalError(error, fallback = 'Əməliyyat mümkün olmadı. Yenidən cəhd edin.') {
  return error?.data?.error || error?.message || fallback;
}
