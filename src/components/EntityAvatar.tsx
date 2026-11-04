interface EntityAvatarProps {
  name: string;
  size?: 'sm' | 'md';
}

const EntityAvatar = ({ name, size = 'md' }: EntityAvatarProps) => {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizeClasses = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  return (
    <div
      className={`${sizeClasses} rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
};

export default EntityAvatar;
