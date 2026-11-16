
import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { apiSlice } from './features/api/apiSlice';
import authReducer, { logout, setCredentials, sessionReplaced } from './features/auth/authSlice';
import { listenForSessionChanges } from './features/auth/sessionSync';

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isAnyOf(logout, setCredentials, sessionReplaced),
  effect: async (_, api) => {
    api.dispatch(apiSlice.util.resetApiState());
  },
});

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      apiSlice.middleware,
      listenerMiddleware.middleware,
    ),
});

setupListeners(store.dispatch);
listenForSessionChanges(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
