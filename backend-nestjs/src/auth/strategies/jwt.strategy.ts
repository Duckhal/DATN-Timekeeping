import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be defined in .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const employeeId = payload.employee_id ?? payload.sub;

    const employee = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: {
        employee_id: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    if (!employee || !employee.is_active) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      employee_id: employee.employee_id,
      email: employee.email,
      role: employee.role,
      scope: payload.scope ?? 'full',
    };
  }
}
