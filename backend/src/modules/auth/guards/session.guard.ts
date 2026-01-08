import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../auth.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract session token from cookie or Authorization header
    const sessionToken = this.extractSessionToken(request);

    if (!sessionToken) {
      throw new UnauthorizedException("No session token provided");
    }

    // Validate session
    const user = await this.authService.validateSession(sessionToken);

    if (!user) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    // Attach user to request
    request.user = user;
    request.sessionToken = sessionToken;

    return true;
  }

  private extractSessionToken(request: any): string | null {
    // Check cookies first
    if (request.cookies && request.cookies.sessionToken) {
      return request.cookies.sessionToken;
    }

    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }
}
