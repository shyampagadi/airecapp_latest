
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../../services/authService';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Link, 
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Custom styling
const LoginContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  overflow: 'hidden',
}));

const CircuitBackground = styled(Box)(({ theme }) => ({
  flex: '0 0 50%',
  background: 'linear-gradient(135deg, #1a237e 0%, #303f9f 100%)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'url("/circuit-pattern.png")',
    backgroundSize: 'cover',
    opacity: 0.15,
  }
}));

const BrandBox = styled(Box)(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}));

const FormBox = styled(Box)(({ theme }) => ({
  flex: '0 0 50%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: theme.spacing(4),
}));

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signIn(username, password);
        console.log('Login successful');
        navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      {/* Left side - Circuit pattern background with brand */}
      <CircuitBackground>
        <BrandBox>
          <Typography variant="h1" sx={{ 
            color: 'white', 
            fontSize: '4rem',
            fontWeight: 700,
            marginBottom: 2
          }}>
            AI
          </Typography>
          <Typography variant="h1" sx={{ 
            color: 'white', 
            fontSize: '4rem',
            fontWeight: 700,
            marginBottom: 4
          }}>
            Recruitment
          </Typography>
          <Box sx={{ 
            width: 150, 
            height: 6, 
            backgroundColor: '#00e5ff', 
            marginBottom: 4 
          }}/>
        </BrandBox>
      </CircuitBackground>
      
      {/* Right side - Login form */}
      <FormBox>
        <Box sx={{ maxWidth: 480, width: '100%', mx: 'auto', px: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <img 
              src="/logo192.png" 
              alt="Logo" 
              style={{ height: 60, marginBottom: 24 }}
            />
            <Typography variant="h4" fontWeight="600" gutterBottom>
              Hello, Welcome!
            </Typography>
            <Typography color="text.secondary">
              Let's get started — enter your info below.
            </Typography>
          </Box>

          {error && (
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: '#fdeded', 
                color: '#d32f2f',
                borderRadius: 1
              }}
            >
              {error}
            </Paper>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              margin="normal"
              id="username"
              label="Email"
              name="username"
              autoComplete="email"
              variant="outlined"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              margin="normal"
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              variant="outlined"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
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
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, mb: 3 }}>
              <Link href="#" variant="body2" underline="hover">
                Forgot password?
              </Link>
            </Box>
                  <Button
                    type="submit"
              fullWidth
              variant="contained"
              size="large"
                    disabled={loading}
              sx={{ 
                py: 1.5, 
                mt: 1, 
                bgcolor: '#0288d1',
                '&:hover': {
                  bgcolor: '#0277bd',
                }
              }}
            >
              {loading ? <CircularProgress size={24} /> : 'SIGN IN'}
                  </Button>
          </form>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2">
              Don't have an account? 
              <Link href="#register" underline="hover" sx={{ ml: 1 }}>
                Register Now
              </Link>
            </Typography>
          </Box>
        </Box>
      </FormBox>
    </LoginContainer>
  );
};

export default Login; 