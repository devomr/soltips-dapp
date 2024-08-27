import { IconInfoSquareRounded } from '@tabler/icons-react';
import React, { ReactNode } from 'react';

interface AnimatedCardNumberProps {
  value: number;
  label: string;
  infoText?: string;
  suffix?: string;
  icon: ReactNode;
}

const AnimatedCardNumber = ({
  value,
  label,
  infoText,
  suffix = '',
  icon,
}: AnimatedCardNumberProps) => {
  return (
    <div className="rounded-box bg-white p-4 drop-shadow">
      <div className="mb-2 flex items-center">
        <div className="text-2xl font-semibold text-gray-900">
          {value} {suffix}
        </div>
      </div>
      <div className="flex items-center gap-2 text-base text-gray-500">
        {icon} {label}
        {infoText && (
          <div className="tooltip" data-tip={infoText}>
            <IconInfoSquareRounded size={20} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimatedCardNumber;
