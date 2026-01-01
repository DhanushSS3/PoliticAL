import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ImpersonationService } from '../impersonation.service';

@Injectable()
export class ImpersonationGuard implements CanActivate {
    constructor(private impersonationService: ImpersonationService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // Extract impersonation token
        const impersonationToken = this.extractImpersonationToken(request);

        if (!impersonationToken) {
            throw new UnauthorizedException('No impersonation token provided');
        }

        // Validate impersonation session
        const session = await this.impersonationService.validateImpersonation(impersonationToken);

        if (!session) {
            throw new UnauthorizedException('Invalid or expired impersonation session');
        }

        // Attach both admin and target user to request
        request.admin = session.admin;
        request.user = session.targetUser;
        request.impersonationToken = impersonationToken;
        request.isImpersonating = true;

        return true;
    }

    private extractImpersonationToken(request: any): string | null {
        // Check cookies
        if (request.cookies && request.cookies.impersonationToken) {
            return request.cookies.impersonationToken;
        }

        // Check header
        const impersonationHeader = request.headers['x-impersonation-token'];
        if (impersonationHeader) {
            return impersonationHeader;
        }

        return null;
    }
}
