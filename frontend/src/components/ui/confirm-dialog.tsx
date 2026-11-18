import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from './button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/20 animate-in fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-white p-5 shadow-popover animate-in fade-in-0 zoom-in-95">
          <AlertDialog.Title className="text-[15px] font-semibold text-ink">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="mt-1.5 text-[13px] text-muted">{description}</AlertDialog.Description>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" size="md" className="px-4">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" size="md" className="px-4" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
