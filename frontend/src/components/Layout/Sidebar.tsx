import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Box } from '@mui/material';
import {
  Upload as UploadIcon,
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Policy as PolicyIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { UserGroup } from '../../types';

interface SidebarProps {
  userGroup: UserGroup | null;
  open: boolean;
}

const drawerWidth = 220; // 240에서 220으로 축소

export function Sidebar({ userGroup, open }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const aGroupMenuItems = [
    { text: t('nav.upload'), icon: <UploadIcon />, path: '/upload' },
    { text: t('nav.myRequests'), icon: <AssessmentIcon />, path: '/my-requests' },
  ];

  const bGroupMenuItems = [
    { text: t('nav.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: t('nav.history'), icon: <HistoryIcon />, path: '/history' },
    { text: t('nav.agentConfig'), icon: <SettingsIcon />, path: '/admin/agents' },
    { text: t('nav.policyManagement'), icon: <PolicyIcon />, path: '/admin/policies' },
  ];

  const menuItems = userGroup === 'Requester_Group' ? aGroupMenuItems : userGroup === 'Reviewer_Group' ? bGroupMenuItems : [];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          top: '70px',
          borderRight: '1px solid #e0e0e0',
          bgcolor: '#ffffff',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', py: 2, px: 1.5 }}>
        <List sx={{ p: 0 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 1,
                  py: 1.5,
                  px: 2,
                  '&.Mui-selected': {
                    bgcolor: '#00467F',
                    color: 'white',
                    '&:hover': {
                      bgcolor: '#003366',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  '&:hover': {
                    bgcolor: '#f5f5f5',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#00467F' }}>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{ 
                    fontWeight: 500, 
                    fontSize: '0.875rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}
