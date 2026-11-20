export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  isAdmin: boolean;
};

export type Session = { user: User; accessToken: string };
