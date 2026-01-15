import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Architecture as ArchIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: '#f5f5f5',
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: 5, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <ArchIcon sx={{ fontSize: 56, color: '#00467F', mb: 2 }} />
            <Typography component="h1" variant="h4" fontWeight={700} gutterBottom color="#00467F">
              Architecture Review System
            </Typography>
            <Typography variant="body1" color="text.secondary">
              AWS Well-Architected Framework 기반 아키텍처 리뷰
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="이메일"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="비밀번호"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ 
                py: 1.5, 
                fontSize: '1rem', 
                fontWeight: 600,
                bgcolor: '#00467F',
                '&:hover': {
                  bgcolor: '#003366',
                }
              }}
            >
              로그인
            </Button>

            <Paper sx={{ mt: 3, p: 2.5, bgcolor: '#f8f9fa', border: '1px solid #e0e0e0' }} elevation={0}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom color="#00467F">
                💡 테스트 계정
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  제출자 (Requester_Group)
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  이메일: requester@example.com
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  패스워드: TempPass123! (첫 로그인 시 변경)
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  검토자 (Reviewer_Group)
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  이메일: reviewer@example.com
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  패스워드: TempPass123! (첫 로그인 시 변경)
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
