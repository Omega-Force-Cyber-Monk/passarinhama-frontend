export type NotificationType =
  | 'account_approved'
  | 'new_article'
  | 'new_document'
  | 'new_event'
  | 'new_post'
  | 'new_training'
  | 'post_rejected'
  | 'post_reply'
  | string;

export interface NotificationPreference {
  id: string;
  email_enabled: boolean;
  user_id: string;
  notification_type: NotificationType;
  forum_id: string | null;
  updated_at: string;
}

export interface UpdateNotificationPreferenceRequest {
  notification_type: NotificationType;
  email_enabled: boolean;
}

export const notificationTypeLabelKeys: Partial<
  Record<NotificationType, string>
> = {
  account_approved: 'profilePage.notificationLabels.accountApproved',
  new_article: 'profilePage.notificationLabels.newArticle',
  new_document: 'profilePage.notificationLabels.newDocument',
  new_event: 'profilePage.notificationLabels.newEvent',
  new_post: 'profilePage.notificationLabels.newPost',
  new_training: 'profilePage.notificationLabels.newTraining',
  post_rejected: 'profilePage.notificationLabels.postRejected',
  post_reply: 'profilePage.notificationLabels.postReply',
};

export const getNotificationLabelKey = (type: NotificationType) =>
  notificationTypeLabelKeys[type];
