import { Auth } from 'aws-amplify';

export const signIn = async (username, password) => {
  try {
    console.log('authService: Attempting sign in');
    const user = await Auth.signIn(username, password);
    console.log('authService: Sign in successful');
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('authService: Sign in error:', error);
    return {
      success: false,
      message: error.message || 'Failed to sign in'
    };
  }
};

export const signOut = async () => {
  try {
    console.log('authService: Attempting sign out');
    await Auth.signOut();
    console.log('authService: Sign out successful');
    return { success: true };
  } catch (error) {
    console.error('authService: Sign out error:', error);
    return {
      success: false,
      message: error.message || 'Failed to sign out'
    };
  }
};

export const getCurrentUser = async () => {
  try {
    console.log('authService: Checking for current user');
    const user = await Auth.currentAuthenticatedUser();
    console.log('authService: Current user found');
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('authService: Current user error:', error);
    // Don't treat "No current user" as an error
    if (error.message === 'No current user') {
      return {
        success: false,
        message: 'No authenticated user'
      };
    }
    return {
      success: false,
      message: error.message || 'No authenticated user'
    };
  }
};

export const getAuthToken = async () => {
  try {
    console.log('authService: Getting auth token');
    const session = await Auth.currentSession();
    const token = session.getAccessToken().getJwtToken();
    console.log('authService: Auth token retrieved');
    return token;
  } catch (error) {
    console.error('authService: Error getting auth token:', error);
    return null;
  }
}; 