import { Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Upload as UploadIcon,
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const aGroupCards = [
    {
      title: language === 'ko' ? '문서 업로드' : 'Upload Document',
      description: language === 'ko' 
        ? '새로운 아키텍처 문서를 업로드하고 검토를 요청하세요'
        : 'Upload new architecture documents and request a review',
      icon: <UploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/upload',
      action: language === 'ko' ? '업로드하기' : 'Upload',
    },
    {
      title: language === 'ko' ? '내 검토 요청' : 'My Requests',
      description: language === 'ko'
        ? '제출한 검토 요청의 상태와 결과를 확인하세요'
        : 'Check the status and results of your submitted review requests',
      icon: <HistoryIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/my-requests',
      action: language === 'ko' ? '확인하기' : 'View',
    },
  ];

  const bGroupCards = [
    {
      title: language === 'ko' ? '아키텍처 리뷰 대시보드' : 'Architecture Review Dashboard',
      description: language === 'ko'
        ? '대기 중인 검토 요청을 확인하고 검토를 시작하세요'
        : 'Check pending review requests and start reviewing',
      icon: <DashboardIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/dashboard',
      action: language === 'ko' ? '대시보드 열기' : 'Open Dashboard',
    },
    {
      title: language === 'ko' ? '아키텍처 리뷰 에이전트 설정' : 'Agent Configuration',
      description: language === 'ko'
        ? 'Well-Architected Pillar별 AI 에이전트 프롬프트를 관리하세요'
        : 'Manage AI agent prompts for each Well-Architected Pillar',
      icon: <SettingsIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/admin/agents',
      action: language === 'ko' ? '설정하기' : 'Configure',
    },
  ];

  const cards = user?.group === 'Requester_Group' ? aGroupCards : user?.group === 'Reviewer_Group' ? bGroupCards : [];

  const getWelcomeMessage = () => {
    if (language === 'ko') {
      return `환영합니다, ${user?.name}님`;
    }
    return `Welcome, ${user?.name}`;
  };

  const getSubtitle = () => {
    if (user?.group === 'Requester_Group') {
      return language === 'ko'
        ? '아키텍처 문서를 업로드하고 전문가의 검토를 받으세요.'
        : 'Upload architecture documents and get expert reviews.';
    }
    if (user?.group === 'Reviewer_Group') {
      return language === 'ko'
        ? 'AWS Well-Architected Framework 기반으로 아키텍처를 검토하세요.'
        : 'Review architectures based on AWS Well-Architected Framework.';
    }
    return language === 'ko'
      ? 'Architecture Review System에 오신 것을 환영합니다.'
      : 'Welcome to the Architecture Review System.';
  };

  const features = language === 'ko' ? [
    'AWS Well-Architected Framework 6개 Pillar 기반 검토',
    'Amazon Bedrock AI 에이전트 활용',
    '거버넌스 정책 자동 검증',
    '검토 결과 리포트 생성 (PDF/Word)',
    'Infrastructure as Code 템플릿 생성',
    '문서 버전 관리 및 히스토리 추적',
  ] : [
    'Review based on 6 AWS Well-Architected Framework Pillars',
    'Powered by Amazon Bedrock AI Agents',
    'Automatic governance policy validation',
    'Review report generation (PDF/Word)',
    'Infrastructure as Code template generation',
    'Document version control and history tracking',
  ];

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
          {getWelcomeMessage()}
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400, fontSize: '1.125rem' }}>
          {getSubtitle()}
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
          {language === 'ko' ? '시스템 기능' : 'System Features'}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {features.slice(0, 3).map((feature, index) => (
              <Typography key={index} variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
                {feature}
              </Typography>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            {features.slice(3).map((feature, index) => (
              <Typography key={index} variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <Box component="span" sx={{ color: '#00467F', mr: 1, fontWeight: 700 }}>✓</Box>
                {feature}
              </Typography>
            ))}
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
