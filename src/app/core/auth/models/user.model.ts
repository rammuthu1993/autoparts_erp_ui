export interface AuthenticatedUser {
  id: number;
  uuid: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}
