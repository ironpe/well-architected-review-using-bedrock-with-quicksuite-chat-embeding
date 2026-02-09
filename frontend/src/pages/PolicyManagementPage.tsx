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
  Switch,
  Chip,
} from '@mui/material';
import { Delete as DeleteIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

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
  const { t, language } = useLanguage();

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
      setError(t('error.serverError'));
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
      setSuccess(t('policy.uploadSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload policies
      await loadPolicies();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || t('error.serverError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm(t('policy.deleteConfirm'))) {
      return;
    }

    try {
      await api.deleteGovernancePolicy(policyId);
      setSuccess(t('policy.deleteSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload policies
      await loadPolicies();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.error || t('error.serverError'));
    }
  };

  const handleToggleActive = async (policyId: string, currentActive: boolean) => {
    try {
      setError('');
      await api.toggleGovernancePolicyActive(policyId, !currentActive);
      
      // Update local state immediately
      setPolicies(prev => prev.map(p => 
        p.policyId === policyId ? { ...p, isActive: !currentActive } : p
      ));
      
      setSuccess(!currentActive ? t('policy.activateSuccess') : t('policy.deactivateSuccess'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Toggle error:', err);
      setError(err.response?.data?.error || t('error.serverError'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {t('policy.pageTitle')}
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<UploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          {t('policy.uploadPolicy')}
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
                  <TableCell>{t('policy.policyTitle')}</TableCell>
                  <TableCell>{t('policy.policyDescription')}</TableCell>
                  <TableCell>{t('policy.fileName')}</TableCell>
                  <TableCell align="center">{t('policy.status')}</TableCell>
                  <TableCell>{t('policy.uploadedBy')}</TableCell>
                  <TableCell>{t('policy.uploadedAt')}</TableCell>
                  <TableCell align="center">{t('myRequests.actions')}</TableCell>
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
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Switch
                          checked={policy.isActive}
                          onChange={() => handleToggleActive(policy.policyId, policy.isActive)}
                          color="success"
                          size="small"
                        />
                        <Chip
                          label={policy.isActive ? t('policy.active') : t('policy.inactive')}
                          color={policy.isActive ? 'success' : 'default'}
                          size="small"
                          variant={policy.isActive ? 'filled' : 'outlined'}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{policy.uploadedBy}</TableCell>
                    <TableCell>{formatDate(policy.uploadedAt)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={t('common.delete')}>
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
                {t('policy.noPolicies')}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('policy.uploadDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('policy.policyTitle')}
            value={newPolicy.title}
            onChange={(e) => setNewPolicy(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mt: 2, mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label={t('policy.policyDescription')}
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
            {newPolicy.file ? newPolicy.file.name : t('policy.selectFile')}
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
          <Button onClick={() => setUploadDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleUpload}
            disabled={!newPolicy.file || !newPolicy.title || uploading}
          >
            {uploading ? t('upload.uploading') : t('policy.uploadPolicy')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
