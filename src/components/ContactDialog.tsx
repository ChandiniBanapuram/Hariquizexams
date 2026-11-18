import { useState } from 'react';
import { Box, Typography, Button, Stack, Dialog, DialogContent, DialogTitle, IconButton, Tooltip } from '@mui/material';
import { Close as CloseIcon, ContentCopy as CopyIcon, Email as EmailIcon, Phone as PhoneIcon, Send as SendIcon } from '@mui/icons-material';

interface ContactDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactDialog({ open, onClose }: ContactDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('sairohit4531@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropProps={{
        sx: {
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }
      }}
      PaperProps={{
        sx: {
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 30, 60, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(42,255,255,0.18)',
          borderRadius: '24px',
          color: '#fff',
          minWidth: { xs: '90vw', sm: 440 },
          maxWidth: 460,
          boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 60px rgba(42,255,255,0.1)',
          animation: 'contactPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          '@keyframes contactPop': {
            from: { opacity: 0, transform: 'scale(0.92)' },
            to: { opacity: 1, transform: 'scale(1)' },
          },
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 1, pt: 3, px: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', mb: 0.5 }}>
            Contact Information
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
            Reach out to our support team. We typically respond within 24 hours.
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: 'rgba(255,255,255,0.5)',
            ml: 1,
            '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 4, pb: 4, pt: 2 }}>
        <Stack spacing={2.5}>
          <Box sx={{ background: 'rgba(0,0,0,0.25)', p: 2.2, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EmailIcon fontSize="small" /> Email Address
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body1" sx={{ fontWeight: 600 }}>sairohit4531@gmail.com</Typography>
              <Tooltip title={copied ? "Copied!" : "Copy Email"}>
                <IconButton size="small" onClick={handleCopy} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#2affff' } }}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Box sx={{ background: 'rgba(0,0,0,0.25)', p: 2.2, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: '#2affff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PhoneIcon fontSize="small" /> Mobile Number
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>+91 8142445315</Typography>
          </Box>

          <Button
            variant="contained"
            fullWidth
            startIcon={<SendIcon />}
            href="mailto:sairohit4531@gmail.com"
            sx={{
              mt: 1,
              py: 1.6,
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '0.95rem',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #22c55e 100%)',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(59,130,246,0.35), 0 4px 16px rgba(34,197,94,0.25)',
              transition: 'all 0.25s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #16a34a 100%)',
                boxShadow: '0 12px 32px rgba(59,130,246,0.45), 0 6px 20px rgba(34,197,94,0.35)',
                transform: 'scale(1.02)',
              }
            }}
          >
            Send Mail
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
