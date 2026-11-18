import type { ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center px-6 pt-[18vh] text-center" role="status">
      <span className="mb-4 text-faint [&_svg]:size-10 [&_svg]:stroke-[1.5]">{icon}</span>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-3 text-sm">{action}</div> : null}
    </div>
  );
}
