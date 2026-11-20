import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('healthCheck', () => {
    it('responde ok con el estado de la base', () => {
      const result = appController.healthCheck();

      expect(result.status).toBe('ok');
      expect(result.database.status).toBe('connected');
      expect(typeof result.uptime).toBe('number');
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });
  });
});
