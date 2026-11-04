import { useCallback } from 'react';
import { usePermissions } from './usePermissions';
import { canModifyArticle } from '../redux/features/articles/articleAuthorization';
import type { Article } from '../redux/features/articles/articleTypes';

export const useArticleAuthorization = () => {
  const { user, ready } = usePermissions();
  return useCallback((article: Pick<Article, 'id' | 'author'> | null | undefined, action: 'edit' | 'delete') =>
    ready && canModifyArticle(user, article, action), [ready, user]);
};
