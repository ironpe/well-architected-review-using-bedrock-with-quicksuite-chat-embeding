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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Collapse,
} from '@mui/material';
import { 
  Visibility as ViewIcon,
  Description as PreviewIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ReviewStatus, ReviewRequest } from '../types';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const mockHistory = [
  {
    reviewRequestId: 'req-001',
    documentTitle: 'E-Commerce 마이크로서비스 아키텍처',
    submitterEmail: 'submitter@example.com',
    reviewerEmail: 'reviewer@example.com',
    status: 'In Review' as ReviewStatus,
    currentVersion: 1,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    reviewRequestId: 'req-002',
    documentTitle: 'IoT 데이터 파이프라인 설계',
    submitterEmail: 'submitter@example.com',
    reviewerEmail: 'reviewer@example.com',
    status: 'Review Completed' as ReviewStatus,
    currentVersion: 2,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2일 전
    updatedAt: new Date().toISOString(), // 방금
  },
  {
    reviewRequestId: 'req-003',
    documentTitle: 'ML 모델 서빙 인프라',
    submitterEmail: 'developer@example.com',
    reviewerEmail: 'reviewer@example.com',
    status: 'Modification Required' as ReviewStatus,
    currentVersion: 1,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3일 전
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
  },
];

export function HistoryPage() {
  const [history, setHistory] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'All'>('All');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewRequest | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [executionHistory, setExecutionHistory] = useState<Record<string, any[]>>({});
  const [loadingExecutions, setLoadingExecutions] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { t, language } = useLanguage();
  
  // Requester_Group 사용자인지 확인
  const isRequester = user?.group === 'Requester_Group';
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const result = await api.listReviewRequests();
      setHistory(result.reviewRequests);
    } catch (err: any) {
      // Fallback to mock data for local development
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        console.warn('API not available, using mock data');
        setHistory(mockHistory);
      } else {
        setError(err.response?.data?.error || '히스토리를 불러오는데 실패했습니다');
        setHistory(mockHistory); // Fallback to mock
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

  const handleViewDetails = (item: ReviewRequest) => {
    console.log('View details clicked:', {
      reviewRequestId: item.reviewRequestId,
      status: item.status,
      executionId: item.executionId,
      documentTitle: item.documentTitle,
    });

    // 검토 완료된 경우 결과 페이지로
    if (item.status === 'Review Completed' && item.executionId) {
      console.log('Navigating to results page:', item.executionId);
      navigate(`/reviews/${item.executionId}/results`);
    } 
    // 검토 대기 중인 경우 검토 실행 페이지로
    else if (item.status === 'Pending Review') {
      console.log('Navigating to execute page (pending):', item.reviewRequestId);
      navigate(`/reviews/${item.reviewRequestId}/execute`);
    }
    // 검토 중이거나 기타 상태인 경우 검토 실행 페이지로
    else {
      console.log('Navigating to execute page (other):', item.reviewRequestId);
      navigate(`/reviews/${item.reviewRequestId}/execute`);
    }
  };

  const handlePreview = async (item: ReviewRequest) => {
    try {
      const url = await api.getDocumentPreviewUrl(item.documentId);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      setError('문서 프리뷰를 불러오는데 실패했습니다');
    }
  };

  const handleDeleteClick = (item: ReviewRequest) => {
    setDeleteTarget(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.deleteReviewRequest(deleteTarget.reviewRequestId);
      
      // Remove from list
      setHistory(prev => prev.filter(h => h.reviewRequestId !== deleteTarget.reviewRequestId));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '삭제에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadReport = async (item: ReviewRequest) => {
    if (!item.executionId) {
      setError('검토 결과가 없습니다');
      return;
    }

    try {
      setDownloading(item.reviewRequestId);
      
      // Download PDF report
      const blob = await api.downloadPdfReport(item.executionId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architecture-review-${item.documentTitle || item.documentId}-${new Date().toISOString().split('T')[0]}.pdf`;
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

  const handleToggleExpand = async (reviewRequestId: string) => {
    const newExpanded = new Set(expandedRows);
    
    if (newExpanded.has(reviewRequestId)) {
      newExpanded.delete(reviewRequestId);
    } else {
      newExpanded.add(reviewRequestId);
      
      // Load execution history if not already loaded
      if (!executionHistory[reviewRequestId]) {
        setLoadingExecutions(prev => new Set(prev).add(reviewRequestId));
        try {
          console.log('Fetching executions for:', reviewRequestId);
          const result = await api.getReviewExecutions(reviewRequestId);
          console.log('Executions result:', result);
          setExecutionHistory(prev => ({
            ...prev,
            [reviewRequestId]: result.executions,
          }));
        } catch (err: any) {
          console.error('Failed to fetch executions:', err);
          console.error('Error response:', err.response?.data);
          setError(`검토 이력을 불러오는데 실패했습니다: ${err.response?.data?.error || err.message}`);
        } finally {
          setLoadingExecutions(prev => {
            const newSet = new Set(prev);
            newSet.delete(reviewRequestId);
            return newSet;
          });
        }
      }
    }
    
    setExpandedRows(newExpanded);
  };

  const handleDownloadExecutionReport = async (executionId: string, documentTitle: string) => {
    try {
      setDownloading(executionId);
      
      const blob = await api.downloadPdfReport(executionId);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architecture-review-${documentTitle}-${executionId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`;
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

  const getSubmitterDisplay = (item: ReviewRequest): string => {
    // 이메일 주소를 우선적으로 표시
    return item.submitterEmail || item.submitterUserId || 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US');
  };

  const filteredHistory = history.filter(item => {
    const documentTitle = item.documentTitle || item.documentId;
    const submitterDisplay = getSubmitterDisplay(item);
    const matchesSearch = documentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submitterDisplay.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.submitterEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        {t('history.pageTitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label={t('common.search')}
            placeholder={t('history.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('history.statusFilter')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('history.statusFilter')}
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | 'All')}
            >
              <MenuItem value="All">{t('history.all')}</MenuItem>
              <MenuItem value="Pending Review">{t('status.pendingReview')}</MenuItem>
              <MenuItem value="In Review">{t('status.inReview')}</MenuItem>
              <MenuItem value="Modification Required">{t('status.modificationRequired')}</MenuItem>
              <MenuItem value="Review Completed">{t('status.reviewCompleted')}</MenuItem>
              <MenuItem value="Rejected">{t('status.rejected')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
<TableRow>
                  <TableCell width="40px" />
                  <TableCell width="18%">{t('history.documentName')}</TableCell>
                  <TableCell width="14%">{t('history.submitter')}</TableCell>
                  <TableCell width="14%">{t('history.reviewer')}</TableCell>
                  <TableCell width="8%">{t('myRequests.status')}</TableCell>
                  <TableCell width="7%" sx={{ whiteSpace: 'nowrap' }}>{t('history.documentVersion')}</TableCell>
                  <TableCell width="7%" sx={{ whiteSpace: 'nowrap' }}>{t('history.reviewCount')}</TableCell>
                  <TableCell width="11%">{t('myRequests.createdAt')}</TableCell>
                  <TableCell width="11%" sx={{ whiteSpace: 'nowrap' }}>{t('history.lastReviewDate')}</TableCell>
                  <TableCell align="center" width="10%">{t('myRequests.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.map((item) => (
                  <>
                    <TableRow key={item.reviewRequestId} hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleExpand(item.reviewRequestId)}
                        >
                          {expandedRows.has(item.reviewRequestId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.documentTitle || item.documentId}
                        </Typography>
                      </TableCell>
                      <TableCell>{getSubmitterDisplay(item)}</TableCell>
                      <TableCell>{item.reviewerEmail}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(item.status)}
                          color={getStatusColor(item.status)}
                          size="small"
                          sx={{ borderRadius: '4px' }}
                        />
                      </TableCell>
                      <TableCell>v{item.currentVersion}</TableCell>
                      <TableCell>
                        {executionHistory[item.reviewRequestId] 
                          ? `${executionHistory[item.reviewRequestId].length}${language === 'ko' ? '회' : ''}`
                          : '-'}
                      </TableCell>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                      <TableCell>{formatDate(item.updatedAt)}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title={t('myRequests.documentPreview')}>
                            <IconButton 
                              size="small" 
                              color="info"
                              onClick={() => handlePreview(item)}
                            >
                              <PreviewIcon />
                            </IconButton>
                          </Tooltip>
                          {item.status === 'Review Completed' && (
                            <Tooltip title={t('myRequests.viewResults')}>
                              <span>
                                <IconButton 
                                  size="small" 
                                  color="primary"
                                  onClick={() => handleViewDetails(item)}
                                  disabled={!item.executionId}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {item.status === 'Review Completed' && (
                            <Tooltip title={t('myRequests.downloadReport')}>
                              <span>
                                <IconButton 
                                  size="small" 
                                  color="success"
                                  onClick={() => handleDownloadReport(item)}
                                  disabled={!item.executionId || downloading === item.reviewRequestId}
                                >
                                  {downloading === item.reviewRequestId ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <DownloadIcon />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title={
                            item.status === 'Pending Review' ? t('myRequests.deleteTooltip') :
                            item.status === 'In Review' ? t('myRequests.cannotDeleteInReview') :
                            item.status === 'Review Completed' ? t('myRequests.cannotDeleteCompleted') :
                            t('myRequests.deleteTooltip')
                          }>
                            <span>
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleDeleteClick(item)}
                                disabled={item.status === 'In Review' || item.status === 'Review Completed'}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded row for execution history */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                        <Collapse in={expandedRows.has(item.reviewRequestId)} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 2 }}>
                            <Typography variant="h6" gutterBottom component="div">
                              {t('history.reviewHistory')}
                            </Typography>
                            {loadingExecutions.has(item.reviewRequestId) ? (
                              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={24} />
                              </Box>
                            ) : executionHistory[item.reviewRequestId]?.length > 0 ? (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>{t('history.reviewNumber')}</TableCell>
                                    <TableCell>{t('myRequests.status')}</TableCell>
                                    <TableCell>{t('history.startTime')}</TableCell>
                                    <TableCell>{t('history.completionTime')}</TableCell>
                                    <TableCell>{t('history.selectedPillars')}</TableCell>
                                    <TableCell align="center">{t('myRequests.actions')}</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {executionHistory[item.reviewRequestId].map((execution, index) => (
                                    <TableRow key={execution.executionId}>
                                      <TableCell>#{executionHistory[item.reviewRequestId].length - index}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={execution.status === 'Completed' ? t('status.completed') : execution.status === 'In Progress' ? t('status.inProgress') : execution.status}
                                          color={execution.status === 'Completed' ? 'success' : execution.status === 'In Progress' ? 'info' : 'default'}
                                          size="small"
                                          sx={{ borderRadius: '4px' }}
                                        />
                                      </TableCell>
                                      <TableCell>{formatDate(execution.startedAt)}</TableCell>
                                      <TableCell>{execution.completedAt ? formatDate(execution.completedAt) : '-'}</TableCell>
                                      <TableCell>{execution.selectedPillars?.length || 0}{language === 'ko' ? '개' : ''}</TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                          {execution.status === 'Completed' && (
                                            <>
                                              <Tooltip title={t('history.viewResults')}>
                                                <IconButton
                                                  size="small"
                                                  color="primary"
                                                  onClick={() => navigate(`/reviews/${execution.executionId}/results`)}
                                                >
                                                  <ViewIcon />
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title={t('history.download')}>
                                                <IconButton
                                                  size="small"
                                                  color="success"
                                                  onClick={() => handleDownloadExecutionReport(execution.executionId, item.documentTitle || item.documentId)}
                                                  disabled={downloading === execution.executionId}
                                                >
                                                  {downloading === execution.executionId ? (
                                                    <CircularProgress size={20} />
                                                  ) : (
                                                    <DownloadIcon />
                                                  )}
                                                </IconButton>
                                              </Tooltip>
                                            </>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                {t('history.noHistory')}
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredHistory.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {t('history.noSearchResults')}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* 문서 프리뷰 다이얼로그 */}
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
            {t('history.deleteCannotUndo')}
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
    </Box>
  );
}
