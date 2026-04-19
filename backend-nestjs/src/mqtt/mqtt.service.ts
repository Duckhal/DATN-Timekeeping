import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type MqttClient } from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private brokerUrl = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.brokerUrl =
      this.configService.get<string>('MQTT_BROKER_URL') ?? 'mqtt://127.0.0.1:1883';

    this.client = connect(this.brokerUrl, {
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${this.brokerUrl}`);
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
