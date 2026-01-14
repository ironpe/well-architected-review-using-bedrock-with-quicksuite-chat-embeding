import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { api } from '../services/api';

interface Policy {
  policyId: string;
  title: string;
  description: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
}

export function PolicyManagementPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ title: '', description: '', file: null as File | null });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const result = await api.getGovernancePolicies();
      setPolicies(result.policies || []);
    } catch (err: any) {
      console.error('Failed to load policies:', err);
      setError('정책 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!newPolicy.file || !newPolicy.title) {
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      await api.uploadGovernancePolicy(newPolicy.file, newPolicy.title, newPolicy.description);
      
      setUploadDialogOpen(false);
      setNewPolicy({ title: '', description: '', file: null });
      setSuccess('정책이 성공적으로 업로드되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload policies
      await loadPolicies();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || '정책 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm('이 정책을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await api.deleteGovernancePolicy(policyId);
      setSuccess('정책이 삭제되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload policies
      await loadPolicies();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.error || '정책 삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          거버넌스 정책 관리
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<UploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          정책 업로드
        </Button>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

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
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>정책 제목</TableCell>
                  <TableCell>설명</TableCell>
                  <TableCell>파일명</TableCell>
                  <TableCell>업로드자</TableCell>
                  <TableCell>업로드일</TableCell>
                  <TableCell align="center">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.policyId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {policy.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {policy.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {policy.fileName}
                      </Typography>
                    </TableCell>
                    <TableCell>{policy.uploadedBy}</TableCell>
                    <TableCell>{formatDate(policy.uploadedAt)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="삭제">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(policy.policyId)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {policies.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                등록된 거버넌스 정책이 없습니다.
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>거버넌스 정책 업로드</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="정책 제목"
            value={newPolicy.title}
            onChange={(e) => setNewPolicy(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mt: 2, mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label="정책 설명"
            value={newPolicy.description}
            onChange={(e) => setNewPolicy(prev => ({ ...prev, description: e.target.value }))}
            multiline
            rows={3}
            sx={{ mb: 2 }}
            required
          />

          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<UploadIcon />}
          >
            {newPolicy.file ? newPolicy.file.name : '파일 선택'}
            <input
              type="file"
              hidden
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setNewPolicy(prev => ({ ...prev, file: e.target.files![0] }));
                }
              }}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>취소</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleUpload}
            disabled={!newPolicy.file || !newPolicy.title || uploading}
          >
            {uploading ? '업로드 중...' : '업로드'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
