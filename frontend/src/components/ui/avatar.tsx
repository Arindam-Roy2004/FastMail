import { useState } from 'react';
import { initialOf } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  name: string;
  src?: string | null;
  className?: string;
};

export function Avatar({ name, src, className }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-avatar text-sm font-medium text-white',
        className,
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src!}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}
