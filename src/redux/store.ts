
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { apiSlice } from './features/api/apiSlice';
import authReducer, { logout } from './features/auth/authSlice';

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: logout,
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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
