
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CostItem, CostItemSchema } from './schemas/cost-item.schema';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CostItem.name, schema: CostItemSchema },
    ]),
  ],
  controllers: [CostsController],
  providers: [CostsService],
  exports: [CostsService],
})
export class CostsModule {}
