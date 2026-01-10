import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService, AccessTokenPayload } from "../auth.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract access token from cookie or Authorization header
    const accessToken = this.extractAccessToken(request);

    if (!accessToken) {
      throw new UnauthorizedException("No access token provided");
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.authService.verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Validate session (always hits DB)
    const user = await this.authService.validateSession(payload.sid, {
      expectedUserId: payload.uid,
      deviceInfo: request.headers["user-agent"],
      ipAddress: request.ip || request.socket?.remoteAddress,
    });

    if (!user) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    // Attach user to request
    request.user = user;
    request.sessionId = payload.sid;
    request.accessToken = accessToken;

    return true;
  }

  private extractAccessToken(request: any): string | null {
    // Check cookies first
    if (request.cookies && request.cookies.accessToken) {
      return request.cookies.accessToken;
    }

    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }
}
