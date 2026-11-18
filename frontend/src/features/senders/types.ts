export type Sender = {
  id: string;
  name: string;
  email: string;
  provider: 'ethereal' | 'smtp';
  createdAt: string;
};
