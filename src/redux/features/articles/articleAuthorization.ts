import type { UserProfile } from '../auth/authTypes';
import { canModifyResource } from '../auth/resourceAuthorization';
import type { Article } from './articleTypes';

export const canModifyArticle = (
  user: UserProfile | null | undefined,
  article: Pick<Article, 'id' | 'author'> | null | undefined,
  action: 'edit' | 'delete',
): boolean => {
  return canModifyResource(user, 'article', article, action);
};
