import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.query.token as string) ??
        client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const employeeId: number = payload.employee_id ?? payload.sub;
      (client as any).employeeId = employeeId;

      client.join(`user_${employeeId}`);
      this.logger.log(`[WS] Connected: employee=${employeeId} socket=${client.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const employeeId = (client as any).employeeId;
    if (employeeId) {
      this.logger.log(`[WS] Disconnected: employee=${employeeId} socket=${client.id}`);
    }
  }

  sendToUser(employeeId: number, event: string, payload: any) {
    this.server.to(`user_${employeeId}`).emit(event, payload);
  }
}
