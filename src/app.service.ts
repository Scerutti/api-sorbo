
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  healthCheck(): {
    status: string;
    timestamp: string;
    uptime: number;
    database: {
      status: string;
      connectionState: string;
    };
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'connected',
        connectionState: 'connected',
      },
    };
  }
}
