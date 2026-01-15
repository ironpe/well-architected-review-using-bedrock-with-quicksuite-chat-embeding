import { Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Upload as UploadIcon,
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const aGroupCards = [
    {
      title: '문서 업로드',
      description: '새로운 아키텍처 문서를 업로드하고 검토를 요청하세요',
      icon: <UploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/upload',
      action: '업로드하기',
    },
    {
      title: '내 검토 요청',
      description: '제출한 검토 요청의 상태와 결과를 확인하세요',
      icon: <HistoryIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/my-requests',
      action: '확인하기',
    },
  ];

  const bGroupCards = [
    {
      title: '아키텍처 리뷰 대시보드',
      description: '대기 중인 검토 요청을 확인하고 검토를 시작하세요',
      icon: <DashboardIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/dashboard',
      action: '대시보드 열기',
    },
    {
      title: '아키텍처 리뷰 에이전트 설정',
      description: 'Well-Architected Pillar별 AI 에이전트 프롬프트를 관리하세요',
      icon: <SettingsIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/admin/agents',
      action: '설정하기',
    },
  ];

  const cards = user?.group === 'Requester_Group' ? aGroupCards : user?.group === 'Reviewer_Group' ? bGroupCards : [];

  return (
    <Box>
      <Paper 
        sx={{ 
          p: 4, 
          mb: 3, 
          bgcolor: '#00467F',
          color: 'white',
          borderRadius: 2,
          border: 'none',
        }}
        elevation={0}
      >
        <Typography variant="h3" gutterBottom fontWeight={800} sx={{ fontSize: '2.5rem' }}>
          환영합니다, {user?.name}님
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400, fontSize: '1.125rem' }}>
          {user?.group === 'Requester_Group'
            ? '아키텍처 문서를 업로드하고 전문가의 검토를 받으세요.'
            : user?.group === 'Reviewer_Group'
            ? 'AWS Well-Architected Framework 기반으로 아키텍처를 검토하세요.'
            : 'Architecture Review System에 오신 것을 환영합니다.'}
        </Typography>
      </Paper>

      <Grid container spacing={2.5}>
        {cards.map((card) => (
          <Grid item xs={12} md={6} key={card.path}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.2s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
              }}
              onClick={() => navigate(card.path)}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  {card.icon}
                </Box>
                <Typography variant="h6" component="div" gutterBottom align="center" fontWeight={600}>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  {card.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2.5 }}>
                <Button
                  variant="contained"
                  size="medium"
                  sx={{
                    bgcolor: user?.group === 'Requester_Group' ? '#00467F' : '#E31837',
                    px: 3,
                    py: 1,
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: user?.group === 'Requester_Group' ? '#003366' : '#B71C1C',
                    }
                  }}
                >
                  {card.action}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3, borderRadius: 2 }} elevation={0}>
        <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2, color: '#00467F' }}>
          시스템 기능
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
              AWS Well-Architected Framework 6개 Pillar 기반 검토
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
              Amazon Bedrock AI 에이전트 활용
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
              거버넌스 정책 자동 검증
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
              검토 결과 리포트 생성 (PDF/Word)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
              Infrastructure as Code 템플릿 생성
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
              문서 버전 관리 및 히스토리 추적
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
