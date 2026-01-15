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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Visibility as ViewIcon, GetApp as DownloadIcon, Delete as DeleteIcon, Description as PreviewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ReviewStatus, ReviewRequest } from '../types';
import { api } from '../services/api';

export function MyRequestsPage() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
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

  const handleDeleteClick = (request: ReviewRequest) => {
    setDeleteTarget(request);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.deleteReviewRequest(deleteTarget.reviewRequestId);
      
      // Remove from list
      setRequests(prev => prev.filter(r => r.reviewRequestId !== deleteTarget.reviewRequestId));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '삭제에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async (request: ReviewRequest) => {
    try {
      const url = await api.getDocumentPreviewUrl(request.documentId);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      setError('문서 미리보기를 불러오는데 실패했습니다');
    }
  };

  const handleDownloadReport = async (request: ReviewRequest) => {
    if (!request.executionId) {
      setError('검토 결과가 없습니다');
      return;
    }

    try {
      setDownloading(request.reviewRequestId);
      
      // Download PDF report
      const blob = await api.downloadPdfReport(request.executionId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architecture-review-${request.documentTitle || request.documentId}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || '리포트 다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
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
                        sx={{ borderRadius: '4px' }}
                      />
                    </TableCell>
                    <TableCell>v{request.currentVersion}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell>{formatDate(request.updatedAt)}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title="문서 미리보기">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handlePreview(request)}
                          >
                            <PreviewIcon />
                          </IconButton>
                        </Tooltip>
                        {request.status === 'Review Completed' && (
                          <Tooltip title={request.executionId ? '검토 결과 보기' : '검토 결과 없음'}>
                            <span>
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => navigate(`/reviews/${request.executionId}/results`)}
                                disabled={!request.executionId}
                              >
                                <ViewIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {request.status === 'Review Completed' && (
                          <Tooltip title="리포트 다운로드">
                            <span>
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => handleDownloadReport(request)}
                                disabled={!request.executionId || downloading === request.reviewRequestId}
                              >
                                {downloading === request.reviewRequestId ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <DownloadIcon />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <Tooltip title={request.status === 'Pending Review' ? '삭제' : '검토 대기 중일 때만 삭제 가능'}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(request)}
                              disabled={request.status !== 'Pending Review'}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
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

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
      >
        <DialogTitle>검토 요청 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            "{deleteTarget?.documentTitle || deleteTarget?.documentId}"를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            업로드된 문서와 관련 데이터가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 문서 미리보기 다이얼로그 */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>문서 미리보기</DialogTitle>
        <DialogContent>
          <Box sx={{ height: '70vh', width: '100%' }}>
            <iframe
              src={previewUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Document Preview"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
