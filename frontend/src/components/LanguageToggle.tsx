import { ToggleButton, ToggleButtonGroup, Box } from '@mui/material';
import { useLanguage, Language } from '../contexts/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const handleChange = (_: React.MouseEvent<HTMLElement>, newLanguage: Language | null) => {
    if (newLanguage !== null) {
      setLanguage(newLanguage);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <ToggleButtonGroup
        value={language}
        exclusive
        onChange={handleChange}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            px: 1.5,
            py: 0.5,
            fontSize: '0.75rem',
            fontWeight: 600,
            border: '1px solid rgba(0, 70, 127, 0.3)',
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            },
          },
        }}
      >
        <ToggleButton value="ko">
          한국어
        </ToggleButton>
        <ToggleButton value="en">
          EN
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
