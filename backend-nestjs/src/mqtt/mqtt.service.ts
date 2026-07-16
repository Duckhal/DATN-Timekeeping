import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type MqttClient } from 'mqtt';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private brokerUrl = '';
  private readonly statusTopic = 'timekeeping/devices/status';

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  onModuleInit() {
    this.brokerUrl =
      this.configService.get<string>('MQTT_BROKER_URL') ?? 'mqtt://127.0.0.1:1883';

    this.client = connect(this.brokerUrl, {
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${this.brokerUrl}`);

      // === Subscribe status topic SAU KHI broker accept connection ===
      this.client!.subscribe(this.statusTopic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Subscribe ${this.statusTopic} failed: ${err.message}`);
        } else {
          this.logger.log(`Subscribed to ${this.statusTopic} (QoS 1)`);
        }
      });
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('MQTT connection closed');
    });

    // === Handle incoming status messages ===
    this.client.on('message', (topic, payload, packet) => {
      if (topic === this.statusTopic) {
        this.handleStatusMessage(payload.toString());
      }
    });
  }

  private handleStatusMessage(payload: string) {
    try {
      const data = JSON.parse(payload) as {
        mac_addr?: string;
        status?: string;
      };

      if (!data.mac_addr || !data.status) {
        this.logger.warn(`Invalid status payload: ${payload}`);
        return;
      }

      if (data.status !== 'ACTIVE' && data.status !== 'OFFLINE') {
        this.logger.warn(`Unknown status value: ${data.status}`);
        return;
      }

      this.logger.log(
        `[DeviceStatus] mac=${data.mac_addr} status=${data.status}`,
      );

      this.notificationsGateway.sendToRole('MANAGER', 'device:status', {
        mac_addr: data.mac_addr,
        status: data.status,
        timestamp: Date.now(),
      });
    } catch (err) {
      this.logger.warn(`Failed to parse status payload: ${(err as Error).message}`);
    }
  }

  async publish(topic: string, payload: Record<string, unknown>) {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT broker is not connected');
    }

    const message = JSON.stringify(payload);

    await new Promise<void>((resolve, reject) => {
      this.client!.publish(topic, message, { qos: 1 }, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  onModuleDestroy() {
    if (!this.client) {
      return;
    }

    this.client.end(true);
    this.client = null;
  }
}
