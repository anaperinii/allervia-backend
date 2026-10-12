import { ApiProperty } from '@nestjs/swagger';
import { LifecycleEventType, TherapyStatus } from '@prisma/client';
import { LifecycleRecommendationsDto } from './therapy-lifecycle.dto';

export class ProfessionalRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;
}

export class LifecycleAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: ProfessionalRefDto, nullable: true })
  professional: ProfessionalRefDto | null;
}

export class TherapyLifecycleEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  immunotherapyId: string;

  @ApiProperty({ enum: LifecycleEventType })
  type: LifecycleEventType;

  @ApiProperty({ type: String, nullable: true })
  category: string | null;

  @ApiProperty()
  reason: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expectedReturnAt: Date | null;

  @ApiProperty({ type: LifecycleRecommendationsDto, nullable: true })
  recommendations: unknown;

  @ApiProperty({ type: [String] })
  archivedDoseIds: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty()
  createdById: string;
}

export class TherapyLifecycleEventWithAuthorDto extends TherapyLifecycleEventDto {
  @ApiProperty({ type: LifecycleAuthorDto })
  createdBy: LifecycleAuthorDto;
}

export class TherapyLifecycleResultDto {
  @ApiProperty({ type: TherapyLifecycleEventDto })
  event: TherapyLifecycleEventDto;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty({ description: 'Revisão de concorrência após a transição' })
  revision: number;

  @ApiProperty({ type: [String] })
  archivedDoseIds: string[];
}

export class TherapyLifecycleStateDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TherapyStatus })
  status: TherapyStatus;

  @ApiProperty()
  revision: number;
}

export class TherapyLifecycleHistoryDto {
  @ApiProperty({ type: TherapyLifecycleStateDto })
  therapy: TherapyLifecycleStateDto;

  @ApiProperty({ type: [TherapyLifecycleEventWithAuthorDto] })
  events: TherapyLifecycleEventWithAuthorDto[];
}
