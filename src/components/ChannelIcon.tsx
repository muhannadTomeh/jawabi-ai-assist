import { FaTelegram, FaFacebookMessenger, FaInstagram, FaWhatsapp, FaGlobe } from 'react-icons/fa';
import type { IconType } from 'react-icons';

export type ChannelKey =
  | 'telegram'
  | 'facebook'
  | 'messenger'
  | 'instagram'
  | 'whatsapp'
  | 'web';

interface Info {
  name: string;
  Icon: IconType;
  color: string; // text color class
  bg: string; // tinted bg class
}

export const channelMeta: Record<ChannelKey, Info> = {
  telegram:  { name: 'تيليجرام',   Icon: FaTelegram,          color: 'text-[#0088cc]', bg: 'bg-[#0088cc]/10' },
  facebook:  { name: 'ماسنجر',     Icon: FaFacebookMessenger, color: 'text-[#0084ff]', bg: 'bg-[#0084ff]/10' },
  messenger: { name: 'ماسنجر',     Icon: FaFacebookMessenger, color: 'text-[#0084ff]', bg: 'bg-[#0084ff]/10' },
  instagram: { name: 'انستغرام',   Icon: FaInstagram,         color: 'text-[#E4405F]', bg: 'bg-[#E4405F]/10' },
  whatsapp:  { name: 'واتساب',     Icon: FaWhatsapp,          color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
  web:       { name: 'الموقع',      Icon: FaGlobe,             color: 'text-primary',   bg: 'bg-primary/10' },
};

interface Props {
  channel: string;
  className?: string;
  withBg?: boolean;
  size?: number;
}

export function ChannelIcon({ channel, className = '', withBg = false, size }: Props) {
  const meta = channelMeta[(channel as ChannelKey)] || channelMeta.web;
  const Icon = meta.Icon;
  if (withBg) {
    return (
      <span className={`inline-flex items-center justify-center rounded-lg p-2 ${meta.bg} ${className}`}>
        <Icon className={`h-4 w-4 ${meta.color}`} size={size} />
      </span>
    );
  }
  return <Icon className={`${meta.color} ${className}`} size={size ?? 16} />;
}