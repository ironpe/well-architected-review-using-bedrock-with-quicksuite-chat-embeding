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
import { useLanguage } from '../contexts/LanguageContext';

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
  const { t, language } = useLanguage();

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
        return t('status.pendingReview');
      case 'In Review':
        return t('status.inReview');
      case 'Modification Required':
        return t('status.modificationRequired');
      case 'Review Completed':
        return t('status.reviewCompleted');
      case 'Rejected':
        return t('status.rejected');
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
    return new Date(dateString).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US');
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
        {t('myRequests.pageTitle')}
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
                  <TableCell>{t('myRequests.documentTitle')}</TableCell>
                  <TableCell>{t('myRequests.reviewer')}</TableCell>
                  <TableCell>{t('myRequests.status')}</TableCell>
                  <TableCell>{t('myRequests.version')}</TableCell>
                  <TableCell>{t('myRequests.createdAt')}</TableCell>
                  <TableCell>{t('myRequests.update')}</TableCell>
                  <TableCell align="center">{t('myRequests.actions')}</TableCell>
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
                          {t('myRequests.rejectionReason')}: {request.rejectionReason}
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
                        <Tooltip title={t('myRequests.documentPreview')}>
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handlePreview(request)}
                          >
                            <PreviewIcon />
                          </IconButton>
                        </Tooltip>
                        {request.status === 'Review Completed' && (
                          <Tooltip title={t('myRequests.viewResults')}>
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => navigate(`/reviews/${request.executionId}/results`)}
                                disabled={!request.executionId}
                              >
                                <ViewIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {request.status === 'Review Completed' && (
                          <Tooltip title={t('myRequests.downloadReport')}>
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
                        <Tooltip title={
                          request.status === 'Pending Review' ? t('myRequests.deleteTooltip') :
                          request.status === 'In Review' ? t('myRequests.cannotDeleteInReview') :
                          request.status === 'Review Completed' ? t('myRequests.cannotDeleteCompleted') :
                          t('myRequests.deleteTooltip')
                        }>
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
                {t('myRequests.noRequestsMessage')}
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => navigate('/upload')}
              >
                {t('myRequests.uploadDocument')}
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
        <DialogTitle>{t('myRequests.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            "{deleteTarget?.documentTitle || deleteTarget?.documentId}" {t('myRequests.deleteConfirm')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('myRequests.deleteWarning')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? t('myRequests.deleting') : t('common.delete')}
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
        <DialogTitle>{t('myRequests.documentPreview')}</DialogTitle>
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
          <Button onClick={() => setPreviewOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
