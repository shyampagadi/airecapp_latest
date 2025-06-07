import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Avatar, 
  Box, 
  IconButton, 
  Menu, 
  MenuItem, 
  Divider,
  Badge,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Work as WorkIcon,
  FormatListBulleted as ListIcon
} from '@mui/icons-material';

import { signOut, getCurrentUser } from '../../services/authService';

const Header = () => {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [anchorElNotif, setAnchorElNotif] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log('Header: Checking for authenticated user...');
        const result = await getCurrentUser();
        if (result.success) {
          console.log('Header: User authenticated:', result.user);
          setUser(result.user);
        } else {
          console.log('Header: No authenticated user');
        }
      } catch (error) {
        console.error('Header: Error checking user:', error);
      } finally {
        setAuthChecked(true);
      }
    };

    checkUser();
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('Header: Signing out...');
      const result = await signOut();
      if (result.success) {
        console.log('Header: Sign out successful');
        setUser(null);
        navigate('/login');
      } else {
        console.error('Header: Sign out failed:', result.message);
      }
    } catch (error) {
      console.error('Header: Error signing out:', error);
    }
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleOpenNotifMenu = (event) => {
    setAnchorElNotif(event.currentTarget);
  };

  const handleCloseNotifMenu = () => {
    setAnchorElNotif(null);
  };
  
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Add a fallback for development in case auth is not configured
  const useFallbackUser = !authChecked && process.env.NODE_ENV === 'development';

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
          AI Recruitment
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/dashboard">
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton>
            <ListItemIcon>
              <ListIcon />
            </ListItemIcon>
            <ListItemText primary="Resume List" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton>
            <ListItemIcon>
              <WorkIcon />
            </ListItemIcon>
            <ListItemText primary="Job Descriptions" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              alignItems: 'center',
              fontWeight: 700
            }}
          >
            <Box component="img" src="/logo192.png" sx={{ height: 40, mr: 1 }} />
            AI Recruitment
          </Typography>

          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex' }}>
              <Button
                component={Link}
                to="/dashboard"
                sx={{ my: 2, color: 'inherit', display: 'block' }}
              >
                Dashboard
              </Button>
              <Button
                sx={{ my: 2, color: 'inherit', display: 'block' }}
              >
                Resume List
              </Button>
              <Button
                sx={{ my: 2, color: 'inherit', display: 'block' }}
              >
                Job Descriptions
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              size="large" 
              aria-label="search" 
              color="inherit"
              sx={{ mr: 1 }}
            >
              <SearchIcon />
            </IconButton>
            
            <IconButton
              size="large"
              aria-label="show new notifications"
              color="inherit"
              onClick={handleOpenNotifMenu}
            >
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            
            <Menu
              anchorEl={anchorElNotif}
              open={Boolean(anchorElNotif)}
              onClose={handleCloseNotifMenu}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <MenuItem onClick={handleCloseNotifMenu}>
                <Typography variant="body2">2 new resumes matched your job description</Typography>
              </MenuItem>
              <MenuItem onClick={handleCloseNotifMenu}>
                <Typography variant="body2">5 new candidates available</Typography>
              </MenuItem>
              <MenuItem onClick={handleCloseNotifMenu}>
                <Typography variant="body2">Processing complete for batch #1234</Typography>
              </MenuItem>
            </Menu>
            
            {(user || useFallbackUser) ? (
              <>
                <Box sx={{ ml: 2 }}>
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt={user?.username || 'User'} src="/static/images/avatar.jpg">
                      {(user?.username || 'U')[0].toUpperCase()}
                    </Avatar>
                  </IconButton>
                  <Menu
                    id="menu-appbar"
                    anchorEl={anchorElUser}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                  >
                    <MenuItem onClick={handleCloseUserMenu}>
                      <ListItemIcon>
                        <PersonIcon fontSize="small" />
                      </ListItemIcon>
                      <Typography textAlign="center">Profile</Typography>
                    </MenuItem>
                    <MenuItem onClick={handleCloseUserMenu}>
                      <ListItemIcon>
                        <SettingsIcon fontSize="small" />
                      </ListItemIcon>
                      <Typography textAlign="center">Settings</Typography>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleSignOut}>
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                      </ListItemIcon>
                      <Typography textAlign="center">Sign Out</Typography>
                    </MenuItem>
                  </Menu>
                </Box>
              </>
            ) : (
              <Button component={Link} to="/login" variant="contained" color="primary">
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Header; 