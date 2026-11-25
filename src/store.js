import { changeApiPortal, loadApiSession, useDotnetApi } from './dotnetApi.js';
import { configureStore } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

async function runApi(operation) {
  try {
    return { data: await operation() };
  } catch (error) {
    return { error: { status: error.status || 'CUSTOM_ERROR', data: { error: error.message } } };
  }
}

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/', cache: 'no-store' }),
  tagTypes: ['Portal'],
  endpoints: (build) => ({
    session: build.query({
      async queryFn(params, _api, _extra, workerQuery) {
        if (!useDotnetApi || params.demo) return workerQuery({ url: 'session', params });
        return runApi(() => loadApiSession(params));
      },
      providesTags: (_result, _error, { account, demo }) =>
        account || demo ? [] : ['Portal'],
    }),
    changePortal: build.mutation({
      async queryFn(body, { getState }, _extra, workerQuery) {
        if (!useDotnetApi) return workerQuery({ url: 'portal', method: 'POST', body });
        const session = portalApi.endpoints.session.select({ demo: undefined })(getState()).data;
        return runApi(async () => (await changeApiPortal(body, session)).data);
      },
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
