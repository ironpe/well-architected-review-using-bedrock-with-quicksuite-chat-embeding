import { AppBar, Toolbar, Typography, Button, Box, Chip, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Architecture as ArchIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { ChatButton } from '../ChatButton';
import { UserGroup } from '../../types';

interface HeaderProps {
  isAuthenticated: boolean;
  userGroup: UserGroup | null;
  userEmail?: string;
  onLogout: () => void;
  onChatOpen?: () => void;
}

export function Header({ isAuthenticated, userGroup, userEmail, onLogout, onChatOpen }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <AppBar 
      position="static" 
      elevation={0} 
      sx={{ 
        bgcolor: '#00467F',
        borderBottom: 'none',
      }}
    >
      <Toolbar sx={{ minHeight: 70, px: 3 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            '&:hover': { opacity: 0.9 }
          }} 
          onClick={() => navigate('/')}
        >
          <ArchIcon sx={{ fontSize: 36, mr: 1.5, color: 'white' }} />
          <Typography variant="h5" component="div" sx={{ fontWeight: 800, letterSpacing: '-0.5px', fontSize: '1.5rem' }}>
            Architecture Review System
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {isAuthenticated && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {userGroup && (
              <Chip
                label={userGroup === 'Requester_Group' ? '제출자' : '검토자'}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
            )}
            {userEmail && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '0.875rem' }}>
                  {userEmail[0].toUpperCase()}
                </Avatar>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, fontSize: '0.875rem' }}>
                  {userEmail}
                </Typography>
              </Box>
            )}
            <Button 
              color="inherit" 
              onClick={onLogout}
              startIcon={<LogoutIcon />}
              size="small"
              sx={{ 
                ml: 1,
                bgcolor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                '&:hover': { 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                }
              }}
            >
              로그아웃
            </Button>
            {onChatOpen && <ChatButton onClick={onChatOpen} />}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
