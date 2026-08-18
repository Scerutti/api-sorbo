
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CostItem, CostItemSchema } from './schemas/cost-item.schema';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';
import { ExpensesModule } from '../expenses/expenses.module';
import {
  TipoCosto,
  TipoCostoSchema,
} from '../tipos-costo/schemas/tipo-costo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CostItem.name, schema: CostItemSchema },
      { name: TipoCosto.name, schema: TipoCostoSchema },
    ]),
    ExpensesModule,
  ],
  controllers: [CostsController],
  providers: [CostsService],
  exports: [CostsService],
})
export class CostsModule {}
