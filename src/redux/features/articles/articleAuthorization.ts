import type { UserProfile } from '../auth/authTypes';
import { hasPermission } from '../auth/permissionUtils';
import type { Article } from './articleTypes';

export const canModifyArticle = (
  user: UserProfile | null | undefined,
  article: Pick<Article, 'id' | 'author'> | null | undefined,
  action: 'edit' | 'delete',
): boolean => {
  if (!user?.id || !article?.id) return false;
  if (user.is_superuser === true) return true;
  return Boolean(article.author?.id) &&
    article.author.id === user.id && hasPermission(user, 'article', action);
};
