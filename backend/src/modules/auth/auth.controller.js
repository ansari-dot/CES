import { authService } from './auth.service.js';
import { setAuthCookies, clearAuthCookies, getCookieNames } from '../../shared/http/cookies.js';
import { sendSuccess } from '../../shared/http/response.js';
import { generateCsrfToken } from '../../shared/crypto/tokens.js';

export const authController = {
  async login(req, res, next) {
    try {
      const { identifier, password } = req.body;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;

      const result = await authService.login({
        identifier,
        password,
        userAgent,
        ipAddress
      });

      // Set cookies according to SRS Section 4.2 & 4.4
      setAuthCookies(res, {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        csrfToken: result.tokens.csrfToken
      });

      return sendSuccess(res, result.user, null, 200);
    } catch (error) {
      next(error);
    }
  },

  async refresh(req, res, next) {
    try {
      const cookieNames = getCookieNames();
      const rawRefreshToken = req.cookies[cookieNames.refreshToken] || req.cookies['sms_rt'];
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;

      const result = await authService.refresh({
        rawRefreshToken,
        userAgent,
        ipAddress
      });

      setAuthCookies(res, {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        csrfToken: result.tokens.csrfToken
      });

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async logout(req, res, next) {
    try {
      const familyId = req.user?.sid;
      const cookieNames = getCookieNames();
      const rawRefreshToken = req.cookies?.[cookieNames.refreshToken] || req.cookies?.['sms_rt'];
      await authService.logout({ familyId, rawRefreshToken }).catch(() => {});
    } catch {
      // quiet fallback
    } finally {
      clearAuthCookies(res);
      return sendSuccess(res, { message: 'Successfully logged out' });
    }
  },

  async logoutAll(req, res, next) {
    try {
      const userId = req.user?.id;
      if (userId) {
        await authService.logoutAll({ userId }).catch(() => {});
      }
    } catch {
      // quiet fallback
    } finally {
      clearAuthCookies(res);
      return sendSuccess(res, { message: 'Successfully logged out from all devices' });
    }
  },

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe({ userId: req.user.id });
      return sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  },

  async getCsrf(req, res, next) {
    try {
      const familyId = req.user?.sid || 'anonymous';
      const csrfToken = generateCsrfToken(familyId);
      setAuthCookies(res, { csrfToken });
      return sendSuccess(res, { csrfToken });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword({
        userId: req.user.id,
        currentPassword,
        newPassword
      });
      // Revoking sessions clears cookies and requires re-login
      clearAuthCookies(res);
      return sendSuccess(res, { message: 'Password changed successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }
};
