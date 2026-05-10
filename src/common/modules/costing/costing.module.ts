import { Module, Global } from '@nestjs/common';
import { FifoCostingStrategy } from './fifo-costing.strategy';
import { COSTING_STRATEGY } from './costing-strategy.interface';

@Global()
@Module({
  providers: [
    FifoCostingStrategy,
    { provide: COSTING_STRATEGY, useClass: FifoCostingStrategy },
  ],
  exports: [COSTING_STRATEGY],
})
export class CostingModule {}
