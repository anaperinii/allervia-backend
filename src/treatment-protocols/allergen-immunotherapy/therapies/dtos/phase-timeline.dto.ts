import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PhaseTimelineQueryDto {
  @ApiProperty({ example: '2026-01-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  @ApiProperty({ example: '2026-01-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  @IsString()
  timeZone: string;
}

export class PhaseTimelineDayDto {
  @ApiProperty() date: string;
  @ApiProperty() buildUp: number;
  @ApiProperty() maintenance: number;
}

export class PhaseTimelineResponseDto {
  @ApiProperty() asOf: string;
  @ApiProperty() timeZone: string;
  @ApiProperty({
    description: 'Imunoterapias em andamento consideradas no cálculo',
  })
  totalTherapies: number;
  @ApiProperty({ type: [PhaseTimelineDayDto] })
  days: PhaseTimelineDayDto[];
}
