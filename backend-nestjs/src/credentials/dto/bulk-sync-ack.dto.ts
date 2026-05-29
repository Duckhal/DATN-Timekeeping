import { IsString, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class BulkSyncMappingEntry {
  @IsInt()
  @Min(1)
  employee_id: number;

  @IsInt()
  @Min(1)
  fingerprint_id: number;
}

export class BulkSyncAckDto {
  @IsString()
  mac_addr: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSyncMappingEntry)
  mappings: BulkSyncMappingEntry[];
}
