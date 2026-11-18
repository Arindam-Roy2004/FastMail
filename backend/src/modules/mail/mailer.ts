import nodemailer, { type Transporter } from "nodemailer";

export type SmtpSender = {
  id: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
};

export type OutgoingEmail = {
  emailId: string;
  sender: SmtpSender;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SentInfo = { messageId: string; previewUrl: string | null };

export type Mailer = {
  send(email: OutgoingEmail): Promise<SentInfo>;
};

export const messageIdFor = (emailId: string) => `<${emailId}@email-job-scheduler.local>`;

export const createSmtpMailer = (): Mailer & { close(): void } => {
  const transports = new Map<string, { key: string; transport: Transporter }>();

  const transportFor = (sender: SmtpSender) => {
    // Keyed on the credentials too, so an edited sender gets a fresh connection.
    const key = `${sender.smtpHost}:${sender.smtpPort}:${sender.smtpUser}:${sender.smtpPass}`;
    const cached = transports.get(sender.id);
    if (cached && cached.key === key) return cached.transport;
    cached?.transport.close();

    const transport = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
      pool: true,
      maxConnections: 2,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transports.set(sender.id, { key, transport });
    return transport;
  };

  return {
    async send(email) {
      const info = await transportFor(email.sender).sendMail({
        from: { name: email.sender.name, address: email.sender.email },
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        messageId: messageIdFor(email.emailId),
      });
      const preview = nodemailer.getTestMessageUrl(info);
      return { messageId: info.messageId, previewUrl: preview || null };
    },
    close() {
      for (const { transport } of transports.values()) transport.close();
      transports.clear();
    },
  };
};
