import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/** Authenticated user attached to the request by {@link authenticateToken}. */
export interface AuthUser {
  id: string;
  email?: string;
  /** Project IDs this user may read/write. Empty/undefined => no restriction. */
  projectIds?: string[];
  role?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header and attaches the decoded
 * user to `req.user`. Rejects with 401 when the token is missing/invalid.
 *
 * Fails closed: if `JWT_SECRET` is not configured the server refuses to
 * authenticate anyone rather than silently trusting all callers.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] JWT_SECRET is not configured; rejecting request.');
    res.status(500).json({ success: false, error: 'Server auth not configured' });
    return;
  }

  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: 'Missing bearer token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    req.user = {
      id: String(decoded.sub ?? decoded.id ?? ''),
      email: decoded.email as string | undefined,
      projectIds: Array.isArray(decoded.projectIds)
        ? (decoded.projectIds as string[])
        : undefined,
      role: decoded.role as string | undefined,
    };
    if (!req.user.id) {
      res.status(401).json({ success: false, error: 'Token missing subject' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Returns true if the user is allowed to access the given project. A user with
 * no `projectIds` claim (or an admin role) is treated as unrestricted.
 */
export function canAccessProject(user: AuthUser | undefined, projectId: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.projectIds || user.projectIds.length === 0) return true;
  return user.projectIds.includes(projectId);
}
