import { Controller, Get, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("v1/users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get("profile")
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Patch("profile")
  async updateProfile(@Req() req: any, @Body() body: { profilePhoto?: string }) {
    return this.usersService.updateProfile(req.user.userId, body);
  }

  @Patch("opponent")
  async updateOpponent(@Req() req: any, @Body() body: { opponentId: number }) {
    return this.usersService.updateOpponent(req.user.userId, body.opponentId);
  }

  @Get("opponents")
  async getOpponentCandidates(@Req() req: any) {
    return this.usersService.getOpponentCandidates(req.user.userId);
  }
}
