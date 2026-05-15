import { Module } from '@nestjs/common';

import { ExtractionQueueService } from './extraction-queue.service';

@Module({
  providers: [ExtractionQueueService],
  exports: [ExtractionQueueService]
})
export class QueueModule {}

