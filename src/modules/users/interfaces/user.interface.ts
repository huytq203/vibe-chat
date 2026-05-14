export interface UserRecord {
  id: string; // BigInt serialized as string
  keycloakId: string;
  username: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface UpsertUserPayload {
  keycloakId: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  displayName: string;
  avatarUrl?: string | null;
}
