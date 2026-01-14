import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { Visibility as ViewIcon, GetApp as DownloadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ReviewStatus, ReviewRequest } from '../types';
import { api } from '../services/api';

export function MyRequestsPage() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const result = await api.listReviewRequests();
      setRequests(result.reviewRequests);
    } catch (err: any) {
      // Fallback to mock data for local development
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        console.warn('API not available, using mock data');
        // Mock data
        setRequests([
          {
            reviewRequestId: 'req-001',
            documentId: 'doc-001',
            submitterEmail: 'submitter@example.com',
            submitterUserId: 'user-1',
            reviewerEmail: 'reviewer@example.com',
            status: 'In Review',
            currentVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      } else {
        setError(err.response?.data?.error || '검토 요청을 불러오는데 실패했습니다');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: ReviewStatus): string => {
    switch (status) {
      case 'Pending Review':
        return '검토 대기 중';
      case 'In Review':
        return '검토 중';
      case 'Modification Required':
        return '수정 필요';
      case 'Review Completed':
        return '검토 완료';
      case 'Rejected':
        return '반려됨';
      default:
        return status;
    }
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'Pending Review':
        return 'warning';
      case 'In Review':
        return 'info';
      case 'Review Completed':
        return 'success';
      case 'Modification Required':
        return 'warning';
      case 'Rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        아키텍처 리뷰 요청 목록
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ mt: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>문서 제목</TableCell>
                  <TableCell>검토자</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>버전</TableCell>
                  <TableCell>생성일</TableCell>
                  <TableCell>업데이트</TableCell>
                  <TableCell align="center">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.reviewRequestId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {request.documentTitle || request.documentId}
                      </Typography>
                      {request.status === 'Rejected' && request.rejectionReason && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                          반려 사유: {request.rejectionReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{request.reviewerEmail}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(request.status)}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>v{request.currentVersion}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell>{formatDate(request.updatedAt)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={request.status === 'In Review' ? '검토 진행 중...' : '상세 보기'}>
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              if (request.status === 'Review Completed' && request.executionId) {
                                navigate(`/reviews/${request.executionId}/results`);
                              } else {
                                navigate(`/reviews/${request.reviewRequestId}`);
                              }
                            }}
                            disabled={request.status === 'In Review'}
                          >
                            <ViewIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {request.status === 'Review Completed' && (
                        <Tooltip title="리포트 다운로드">
                          <IconButton size="small" color="primary">
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {requests.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                아직 검토 요청이 없습니다. 문서를 업로드하여 검토를 요청하세요.
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => navigate('/upload')}
              >
                문서 업로드하기
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
