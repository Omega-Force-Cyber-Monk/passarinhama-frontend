import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../redux/store';
import { useGetUsersMeQuery } from '../redux/features/members/membersApi';
import { canModifyArticle } from '../redux/features/articles/articleAuthorization';
import type { Article } from '../redux/features/articles/articleTypes';

export const useArticleAuthorization = () => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const profile = useGetUsersMeQuery(undefined, { skip: !isAuthenticated });
  const ready = isAuthenticated && profile.isSuccess && !profile.isFetching &&
    !profile.isError && profile.data?.id === user?.id;
  return useCallback((article: Pick<Article, 'id' | 'author'> | null | undefined, action: 'edit' | 'delete') =>
    ready && canModifyArticle(user, article, action), [ready, user]);
};
