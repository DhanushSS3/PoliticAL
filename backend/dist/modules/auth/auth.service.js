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
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = require("bcrypt");
let AuthService = class AuthService {
    constructor(prisma) {
        this.prisma = prisma;
        this.SESSION_DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS || "9");
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
        return {
            user: userWithoutPassword,
            sessionToken: session.id,
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
    async validateSession(sessionToken) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionToken },
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
                    },
                },
            },
        });
        if (!session) {
            return null;
        }
        const now = new Date();
        if (session.expiresAt < now) {
            await this.prisma.session.delete({ where: { id: sessionToken } });
            return null;
        }
        if (!session.user.isActive) {
            await this.prisma.session.delete({ where: { id: sessionToken } });
            return null;
        }
        if (session.user.isTrial && session.user.subscription) {
            if (session.user.subscription.endsAt &&
                session.user.subscription.endsAt < now) {
                await this.prisma.session.delete({ where: { id: sessionToken } });
                return null;
            }
        }
        await this.prisma.session.update({
            where: { id: sessionToken },
            data: { lastActivityAt: now },
        });
        return session.user;
    }
    async logout(sessionToken) {
        await this.prisma.session
            .delete({
            where: { id: sessionToken },
        })
            .catch(() => {
        });
    }
    async invalidateAllUserSessions(userId) {
        await this.prisma.session.deleteMany({
            where: { userId },
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map