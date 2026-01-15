/**
 * Authentication Service using AWS Amplify
 */

import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { awsConfig } from '../config/aws-config';
import { User, UserGroup } from '../types';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsConfig.cognito.userPoolId,
      userPoolClientId: awsConfig.cognito.clientId,
      loginWith: {
        email: true,
      },
    },
  },
});

export class AuthService {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<User> {
    try {
      const { isSignedIn } = await signIn({
        username: email,
        password,
      });

      if (!isSignedIn) {
        throw new Error('Sign in failed');
      }

      // Get user details
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await signOut();
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const cognitoUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      // Get ID token
      const idToken = session.tokens?.idToken?.toString();
      if (idToken) {
        localStorage.setItem('authToken', idToken);
      }

      // Parse user groups from token
      const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
      const userGroup = this.getUserGroup(groups);

      const user: User = {
        userId: cognitoUser.userId,
        email: cognitoUser.signInDetails?.loginId || '',
        name: cognitoUser.username,
        group: userGroup,
        cognitoSub: cognitoUser.userId,
      };

      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get user group from Cognito groups
   */
  private getUserGroup(groups: string[]): UserGroup {
    if (groups.includes('Reviewer_Group')) {
      return 'Reviewer_Group';
    }
    if (groups.includes('Requester_Group')) {
      return 'Requester_Group';
    }
    // Default to Requester_Group if no group assigned
    return 'Requester_Group';
  }
}

export const authService = new AuthService();
