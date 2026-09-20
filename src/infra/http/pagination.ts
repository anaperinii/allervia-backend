import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/**
 * Paginação por página para listagens administrativas e clínicas. O escopo
 * entra na própria consulta e no total; nunca se pagina em memória sobre um
 * resultado já truncado.
 */
export class PageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export class PageDto<T> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty({ description: 'Total de registros no escopo da consulta' })
  total: number;
}

export interface PageBounds {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function resolvePage(query: PageQueryDto): PageBounds {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPage<T>(
  items: T[],
  total: number,
  bounds: PageBounds,
): PageDto<T> {
  return { items, total, page: bounds.page, pageSize: bounds.pageSize };
}
