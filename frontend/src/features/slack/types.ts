export type SlackStatus = {
  available: boolean;
  connected: boolean;
  teamName: string | null;
  channel: string | null;
  connectedAt: string | null;
};
