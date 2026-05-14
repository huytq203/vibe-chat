export interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  session_state: string;
  scope: string;
}

export interface KeycloakJwtPayload {
  sub: string; // keycloak_id
  email?: string;
  preferred_username: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  realm_access?: { roles: string[] };
  iat: number;
  exp: number;
}

export interface KeycloakUserRepresentation {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
}
