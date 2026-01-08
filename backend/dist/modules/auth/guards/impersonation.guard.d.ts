import { CanActivate, ExecutionContext } from "@nestjs/common";
import { ImpersonationService } from "../impersonation.service";
export declare class ImpersonationGuard implements CanActivate {
    private impersonationService;
    constructor(impersonationService: ImpersonationService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractImpersonationToken;
}
