import { RoutingMode } from '@prisma/client';

export interface RoutingConfigDto {
  mode: RoutingMode;
  fallbackEnabled: boolean;
  maxRetries: number;
  weights?: Array<{ pspId: string; weight: number }>;
  fallbackSequence?: Array<{ pspId: string; order: number }>;
}

export interface PSPWeightDto {
  pspId: string;
  weight: number;
}

export interface FallbackSequenceDto {
  pspId: string;
  order: number;
}
