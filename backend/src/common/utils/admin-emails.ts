export const parseAdminEmails = (value: string | undefined): string[] => [
  ...new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ),
];
