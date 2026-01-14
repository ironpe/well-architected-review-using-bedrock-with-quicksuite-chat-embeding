import { useState } from 'react';
import { Box, Container } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import ChatWidget from '../ChatWidget';
import { UserGroup } from '../../types';

interface MainLayoutProps {
  isAuthenticated: boolean;
  userGroup: UserGroup | null;
  userEmail?: string;
  onLogout: () => void;
}

export function MainLayout({ isAuthenticated, userGroup, userEmail, onLogout }: MainLayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(450);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      <Header
        isAuthenticated={isAuthenticated}
        userGroup={userGroup}
        userEmail={userEmail}
        onLogout={onLogout}
        onChatOpen={() => setChatOpen(true)}
      />

      <Box sx={{ display: 'flex', flex: 1 }}>
        {isAuthenticated && <Sidebar userGroup={userGroup} open={true} />}

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 70px)',
            bgcolor: '#fafafa',
            marginRight: chatOpen ? `${chatWidth}px` : 0,
            transition: 'margin-right 0.3s ease-in-out',
          }}
        >
          <Container 
            maxWidth="lg" 
            sx={{ 
              py: 3,
              px: 3,
            }}
          >
            <Outlet />
          </Container>
        </Box>
      </Box>

      {/* Chat Widget */}
      {isAuthenticated && (
        <ChatWidget 
          isOpen={chatOpen} 
          onClose={() => setChatOpen(false)}
          onWidthChange={(width) => setChatWidth(width)}
        />
      )}
    </Box>
  );
}
