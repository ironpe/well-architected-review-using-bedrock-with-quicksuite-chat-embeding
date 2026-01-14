import { IconButton, Tooltip, SvgIcon } from '@mui/material';

// QuickSight 스타일 채팅 아이콘
function QuickSightChatIcon(props: any) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M14.07,6.42l2.34.91.92,2.32c.06.15.2.25.37.25s.31-.1.37-.25l.92-2.32,2.34-.91c.15-.06.25-.2.25-.36s-.1-.3-.25-.36l-2.34-.91-.92-2.32c-.06-.15-.2-.25-.37-.25s-.31.1-.37.25l-.92,2.32-2.34.91c-.15.06-.25.2-.25.36s.1.3.25.36Z"></path>
      <path d="M20.78,16.85c.8-1.38,1.22-2.92,1.22-4.49,0-.54-.05-1.08-.15-1.61-.1-.54-.62-.9-1.16-.8-.54.1-.9.62-.8,1.16.08.41.11.83.11,1.25,0,1.33-.39,2.64-1.13,3.79-.15.24-.2.53-.12.8l.58,2.15-2.24-.6c-.26-.07-.54-.03-.77.11-1.29.77-2.78,1.18-4.31,1.18-4.41,0-8-3.33-8-7.42s3.59-7.42,8-7.42c.55,0,1-.45,1-1s-.45-1-1-1C6.49,2.94,2,7.16,2,12.36s4.49,9.42,10,9.42c1.74,0,3.44-.43,4.95-1.25l3.52.94c.35.09.71,0,.97-.26.25-.25.35-.62.26-.97l-.91-3.41Z"></path>
    </SvgIcon>
  );
}

interface ChatButtonProps {
  onClick: () => void;
}

export function ChatButton({ onClick }: ChatButtonProps) {
  return (
    <Tooltip title="AI 어시스턴트" placement="left">
      <IconButton
        onClick={onClick}
        sx={{
          color: 'white',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.1)',
          },
        }}
      >
        <QuickSightChatIcon />
      </IconButton>
    </Tooltip>
  );
}
