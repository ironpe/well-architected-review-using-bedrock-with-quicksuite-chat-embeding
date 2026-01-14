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
import { UserGroup } from '../../types';

interface SidebarProps {
  userGroup: UserGroup | null;
  open: boolean;
}

const drawerWidth = 220; // 240에서 220으로 축소

export function Sidebar({ userGroup, open }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const aGroupMenuItems = [
    { text: '문서 업로드', icon: <UploadIcon />, path: '/upload' },
    { text: '내 검토 요청', icon: <AssessmentIcon />, path: '/my-requests' },
    { text: '히스토리', icon: <HistoryIcon />, path: '/history' },
  ];

  const bGroupMenuItems = [
    { text: '대시보드', icon: <DashboardIcon />, path: '/dashboard' },
    { text: '히스토리', icon: <HistoryIcon />, path: '/history' },
    { text: '에이전트 설정', icon: <SettingsIcon />, path: '/admin/agents' },
    { text: '거버넌스 정책', icon: <PolicyIcon />, path: '/admin/policies' },
  ];

  const menuItems = userGroup === 'A_Group' ? aGroupMenuItems : userGroup === 'B_Group' ? bGroupMenuItems : [];

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
