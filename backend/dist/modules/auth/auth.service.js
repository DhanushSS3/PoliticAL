"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = require("bcrypt");
const jsonwebtoken_1 = require("jsonwebtoken");
let AuthService = class AuthService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        this.SESSION_DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS || "9");
        this.sessionDurationMs = this.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
        this.tokenExpirySeconds = this.sessionDurationMs / 1000;
        this.jwtSecret = this.configService.get("auth.secret", "dev_secret");
    }
    getSessionDurationMs() {
        return this.sessionDurationMs;
    }
    verifyAccessToken(token) {
        return (0, jsonwebtoken_1.verify)(token, this.jwtSecret);
    }
    createAccessToken(session) {
        const payload = {
            sid: session.id,
            uid: session.userId,
        };
        return (0, jsonwebtoken_1.sign)(payload, this.jwtSecret, {
            expiresIn: this.tokenExpirySeconds,
        });
    }
    async hashPassword(password) {
        const saltRounds = 12;
        return bcrypt.hash(password, saltRounds);
    }
    async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    async findByEmailOrPhone(emailOrPhone) {
        return this.prisma.user.findFirst({
            where: {
                OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
            },
            include: {
                subscription: {
                    include: {
                        access: {
                            include: {
                                geoUnit: true,
                            },
                        },
                    },
                },
                candidateProfile: {
                    include: {
                        party: true,
                    },
                },
            },
        });
    }
    async login(dto, deviceInfo, ipAddress) {
        const user = await this.findByEmailOrPhone(dto.emailOrPhone);
        if (!user) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const isPasswordValid = await this.comparePassword(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        if (!user.isActive) {
            throw new common_1.ForbiddenException("Account has been deactivated");
        }
        if (user.isTrial && user.subscription) {
            const now = new Date();
            if (user.subscription.endsAt &&
                user.subscription.endsAt < now) {
                throw new common_1.ForbiddenException("Trial period has expired");
            }
        }
        await this.invalidateAllUserSessions(user.id);
        const session = await this.createSession({
            userId: user.id,
            deviceInfo,
            ipAddress,
        });
        const { passwordHash } = user, userWithoutPassword = __rest(user, ["passwordHash"]);
        const accessToken = this.createAccessToken(session);
        return {
            user: userWithoutPassword,
            accessToken,
        };
    }
    async createSession(dto) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.SESSION_DURATION_DAYS);
        return this.prisma.session.create({
            data: {
                userId: dto.userId,
                deviceInfo: dto.deviceInfo,
                ipAddress: dto.ipAddress,
                expiresAt,
            },
        });
    }
    async validateSession(sessionId, context = {}) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    include: {
                        subscription: {
                            include: {
                                access: {
                                    include: {
                                        geoUnit: true,
                                    },
                                },
                            },
                        },
                        candidateProfile: {
                            include: {
                                party: true,
                            },
                        },
                    },
                },
            },
        });
        if (!session || session.revoked) {
            return null;
        }
        if (context.expectedUserId !== undefined &&
            session.userId !== context.expectedUserId) {
            await this.logout(sessionId);
            return null;
        }
        if (session.deviceInfo &&
            context.deviceInfo &&
            session.deviceInfo !== context.deviceInfo) {
            await this.logout(sessionId);
            return null;
        }
        const now = new Date();
        if (session.expiresAt < now) {
            await this.logout(sessionId);
            return null;
        }
        if (session.ipAddress &&
            context.ipAddress &&
            session.ipAddress !== context.ipAddress) {
            console.warn(`[Auth] IP mismatch for session ${sessionId}: stored ${session.ipAddress}, received ${context.ipAddress}`);
        }
        if (!session.user.isActive) {
            await this.logout(sessionId);
            return null;
        }
        if (session.user.isTrial && session.user.subscription) {
            if (session.user.subscription.endsAt &&
                session.user.subscription.endsAt < now) {
                await this.logout(sessionId);
                return null;
            }
        }
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { lastActivityAt: now },
        });
        return session.user;
    }
    async logout(sessionId) {
        await this.prisma.session
            .update({
            where: { id: sessionId },
            data: { revoked: true, expiresAt: new Date() },
        })
            .catch(() => {
        });
    }
    async invalidateAllUserSessions(userId) {
        await this.prisma.session.updateMany({
            where: { userId, revoked: false },
            data: { revoked: true, expiresAt: new Date() },
        });
    }
    async createUserWithPassword(fullName, email, phone, password, role, isTrial) {
        const tempPassword = password || this.generateTempPassword();
        const hashedPassword = await this.hashPassword(tempPassword);
        const user = await this.prisma.user.create({
            data: {
                fullName,
                email,
                phone,
                passwordHash: hashedPassword,
                role,
                isTrial,
            },
        });
        return { user, tempPassword };
    }
    async setUserPassword(userId, password) {
        const hashedPassword = await this.hashPassword(password);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashedPassword },
        });
    }
    generateTempPassword() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        let password = "";
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    async deactivateUser(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { isActive: false },
        });
        await this.invalidateAllUserSessions(userId);
    }
    async reactivateUser(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { isActive: true },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map