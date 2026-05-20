import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type JwtRequest = {
  user: {
    employee_id: number;
    scope?: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(@Req() req: JwtRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.employee_id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: JwtRequest) {
    return this.authService.me(req.user.employee_id);
  }
}
