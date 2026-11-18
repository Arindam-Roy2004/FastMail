import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-left"
      duration={4000}
      icons={{
        success: <CircleCheck className="size-4 text-brand" />,
        error: <CircleAlert className="size-4 text-red" />,
        info: <Info className="size-4 text-muted" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border !border-line !bg-white !shadow-popover !font-sans !text-sm !text-ink !gap-2.5 !max-w-[360px]',
          description: '!text-[13px] !text-muted',
          actionButton: '!bg-transparent !text-brand !font-medium hover:!text-brand-hover',
        },
      }}
    />
  );
}
