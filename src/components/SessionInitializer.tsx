import { useSelector } from 'react-redux';
import type { RootState } from '../redux/store';
import { useGetUsersMeQuery } from '../redux/features/members/membersApi';

// One persistent subscription owns profile hydration. Guards only observe the store.
export default function SessionInitializer() {
  const token = useSelector((state: RootState) => state.auth.token);
  useGetUsersMeQuery(undefined, {
    skip: !token,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  return null;
}
