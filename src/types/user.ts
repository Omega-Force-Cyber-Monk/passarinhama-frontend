export enum UserStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: UserStatus;
  isPaymentValidated: boolean;
  validatedBy?: string;
  validatedAt?: string;
  city?: string;
  phone?: string;
  category?: string;
  memberSince: string;
  avatarInitials: string;
}
